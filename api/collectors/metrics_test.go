package collectors

import (
	"context"
	"errors"
	"testing"
	"time"
)

// mockReader is a configurable SystemReader for testing.
type mockReader struct {
	cpuPct   float64
	memPct   float64
	netBytes uint64
	diskPct  float64
	cpuErr   error
	memErr   error
	netErr   error
	diskErr  error
}

func (m *mockReader) CPUPercent() (float64, error)          { return m.cpuPct, m.cpuErr }
func (m *mockReader) MemoryPercent() (float64, error)       { return m.memPct, m.memErr }
func (m *mockReader) NetworkBytes() (uint64, error)         { return m.netBytes, m.netErr }
func (m *mockReader) DiskPercent(_ string) (float64, error) { return m.diskPct, m.diskErr }

// --- round2 ---

func TestRound2(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		input float64
		want  float64
	}{
		{"zero", 0, 0},
		{"exact two decimals", 1.23, 1.23},
		{"round down", 1.234, 1.23},
		{"round up", 1.235, 1.24},
		{"many decimals", 3.14159265, 3.14},
		{"negative", -2.555, -2.56},
		{"integer", 42.0, 42.0},
		{"sub-cent rounds to zero", 0.001, 0.0},
	}
	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := round2(tt.input)
			if got != tt.want {
				t.Errorf("round2(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

// --- collectNetwork state machine ---

func TestCollectNetwork_FirstCall_ReturnsZero(t *testing.T) {
	t.Parallel()
	r := &mockReader{netBytes: 1000}
	c := NewMetricsCollectorWithReader(r)
	got := c.collectNetwork(time.Now())
	if got != 0 {
		t.Errorf("first call should return 0 (baseline establishment), got %f", got)
	}
	if !c.hasBaseline {
		t.Error("hasBaseline should be true after first call")
	}
	if c.prevNetBytes != 1000 {
		t.Errorf("prevNetBytes should be 1000, got %d", c.prevNetBytes)
	}
}

func TestCollectNetwork_ComputesDelta(t *testing.T) {
	t.Parallel()
	r := &mockReader{netBytes: 1000}
	c := NewMetricsCollectorWithReader(r)
	t1 := time.Now()
	c.collectNetwork(t1) // establish baseline

	// 1 second later, exactly 1 MiB more bytes transferred
	r.netBytes = 1000 + 1024*1024
	got := c.collectNetwork(t1.Add(time.Second))
	if got != 1.0 {
		t.Errorf("expected 1.0 MB/s, got %f", got)
	}
}

func TestCollectNetwork_CounterReset_ReturnsZero(t *testing.T) {
	t.Parallel()
	r := &mockReader{netBytes: 5000}
	c := NewMetricsCollectorWithReader(r)
	t1 := time.Now()
	c.collectNetwork(t1) // establish baseline

	// Simulate OS counter reset: new value is lower
	r.netBytes = 100
	got := c.collectNetwork(t1.Add(time.Second))
	if got != 0 {
		t.Errorf("expected 0 on counter reset, got %f", got)
	}
	// Should re-baseline to the new counter value
	if c.prevNetBytes != 100 {
		t.Errorf("prevNetBytes should be re-baselined to 100, got %d", c.prevNetBytes)
	}
}

func TestCollectNetwork_ZeroElapsed_ReturnsZero(t *testing.T) {
	t.Parallel()
	r := &mockReader{netBytes: 1000}
	c := NewMetricsCollectorWithReader(r)
	t1 := time.Now()
	c.collectNetwork(t1) // establish baseline

	// Same timestamp — elapsed = 0
	got := c.collectNetwork(t1)
	if got != 0 {
		t.Errorf("expected 0 for zero elapsed time, got %f", got)
	}
}

func TestCollectNetwork_Error_ReturnsZero(t *testing.T) {
	t.Parallel()
	r := &mockReader{netErr: errors.New("network unavailable")}
	c := NewMetricsCollectorWithReader(r)
	got := c.collectNetwork(time.Now())
	if got != 0 {
		t.Errorf("expected 0 on read error, got %f", got)
	}
	if c.hasBaseline {
		t.Error("hasBaseline should remain false on error")
	}
}

// --- collectOnce ---

func TestCollectOnce_PopulatesStore(t *testing.T) {
	t.Parallel()
	r := &mockReader{cpuPct: 55.0, memPct: 70.0, netBytes: 2048, diskPct: 30.0}
	c := NewMetricsCollectorWithReader(r)
	c.collectOnce()

	p := c.Store.GetLatest()
	if p == nil {
		t.Fatal("store should have a point after collectOnce")
	}
	if p.CPU != 55.0 {
		t.Errorf("expected CPU=55.0, got %f", p.CPU)
	}
	if p.Memory != 70.0 {
		t.Errorf("expected Memory=70.0, got %f", p.Memory)
	}
	if p.Disk != 30.0 {
		t.Errorf("expected Disk=30.0, got %f", p.Disk)
	}
	// Network is 0 on the first call (baseline establishment)
	if p.Network != 0 {
		t.Errorf("expected Network=0 on first collectOnce (baseline), got %f", p.Network)
	}
}

func TestCollectOnce_NetworkRateOnSecondCall(t *testing.T) {
	t.Parallel()
	r := &mockReader{cpuPct: 10, memPct: 20, netBytes: 0, diskPct: 40}
	c := NewMetricsCollectorWithReader(r)
	c.collectOnce() // establishes network baseline

	// Second call 1s later with 1 MiB more traffic
	r.netBytes = 1024 * 1024
	// Manually advance prevNetTime to simulate 1s elapsed
	c.prevNetTime = c.prevNetTime.Add(-time.Second)
	c.collectOnce()

	p := c.Store.GetLatest()
	if p == nil {
		t.Fatal("store should have a point")
	}
	// Network rate should be ~1 MB/s; allow small floating-point variance
	if p.Network < 0.99 || p.Network > 1.01 {
		t.Errorf("expected Network ≈ 1.0 MB/s, got %f", p.Network)
	}
}

func TestCollectOnce_ErrorsYieldZeros(t *testing.T) {
	t.Parallel()
	r := &mockReader{
		cpuErr:  errors.New("no cpu"),
		memErr:  errors.New("no mem"),
		netErr:  errors.New("no net"),
		diskErr: errors.New("no disk"),
	}
	c := NewMetricsCollectorWithReader(r)
	c.collectOnce()

	p := c.Store.GetLatest()
	if p == nil {
		t.Fatal("store should have a point even on errors")
	}
	if p.CPU != 0 || p.Memory != 0 || p.Network != 0 || p.Disk != 0 {
		t.Errorf("expected all zeros on errors, got %+v", p)
	}
}

// --- NewMetricsCollectorWithReader ---

func TestNewMetricsCollector_DefaultReader(t *testing.T) {
	t.Parallel()
	// NewMetricsCollector wires the real gopsutil reader; verify it initializes correctly.
	c := NewMetricsCollector()
	if c.Store == nil {
		t.Error("Store should be non-nil")
	}
	if c.reader == nil {
		t.Error("reader should be non-nil")
	}
	if c.hasBaseline {
		t.Error("hasBaseline should start false")
	}
}

func TestNewMetricsCollectorWithReader_InitialState(t *testing.T) {
	t.Parallel()
	r := &mockReader{}
	c := NewMetricsCollectorWithReader(r)
	if c.Store == nil {
		t.Error("Store should be non-nil")
	}
	if c.hasBaseline {
		t.Error("hasBaseline should start false")
	}
	if c.Store.GetLatest() != nil {
		t.Error("store should start empty")
	}
}

// --- Start / context cancellation ---

func TestStart_CollectsImmediately(t *testing.T) {
	t.Parallel()
	r := &mockReader{cpuPct: 25, memPct: 50, diskPct: 10}
	c := NewMetricsCollectorWithReader(r)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	c.Start(ctx)

	// Start performs a synchronous collect before spawning the goroutine
	if c.Store.GetLatest() == nil {
		t.Error("Start should collect at least one sample synchronously")
	}
}

func TestStart_ContextCancellation(t *testing.T) {
	t.Parallel()
	r := &mockReader{cpuPct: 10, memPct: 20, diskPct: 30}
	c := NewMetricsCollectorWithReader(r)
	ctx, cancel := context.WithCancel(context.Background())

	c.Start(ctx)
	cancel() // signal goroutine to exit

	// Allow the goroutine a moment to observe the cancellation
	time.Sleep(50 * time.Millisecond)
	// Verify at least one collect happened before cancellation
	if c.Store.GetLatest() == nil {
		t.Error("expected at least one data point after Start")
	}
}
