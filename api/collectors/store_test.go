package collectors

import (
	"sync"
	"testing"
	"time"
)

func TestDownsampleIncludesDisk(t *testing.T) {
	base := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	points := []MetricsPoint{
		{Timestamp: base, CPU: 10, Memory: 20, Network: 30, Disk: 40},
		{Timestamp: base.Add(10 * time.Second), CPU: 20, Memory: 40, Network: 60, Disk: 80},
	}

	result := Downsample(points, time.Minute)
	if len(result) != 1 {
		t.Fatalf("expected 1 bucket, got %d", len(result))
	}

	got := result[0]
	if got.Disk != 60 {
		t.Errorf("expected Disk=60, got %f", got.Disk)
	}
	if got.CPU != 15 {
		t.Errorf("expected CPU=15, got %f", got.CPU)
	}
	if got.Memory != 30 {
		t.Errorf("expected Memory=30, got %f", got.Memory)
	}
	if got.Network != 45 {
		t.Errorf("expected Network=45, got %f", got.Network)
	}
}

func TestDownsampleMultipleBucketsPreservesDisk(t *testing.T) {
	base := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	points := []MetricsPoint{
		{Timestamp: base, Disk: 10},
		{Timestamp: base.Add(time.Minute), Disk: 20},
	}

	result := Downsample(points, time.Minute)
	if len(result) != 2 {
		t.Fatalf("expected 2 buckets, got %d", len(result))
	}
	if result[0].Disk != 10 {
		t.Errorf("bucket 0: expected Disk=10, got %f", result[0].Disk)
	}
	if result[1].Disk != 20 {
		t.Errorf("bucket 1: expected Disk=20, got %f", result[1].Disk)
	}
}

// --- MetricsStore: NewMetricsStore ---

func TestNewMetricsStore(t *testing.T) {
	t.Parallel()
	s := NewMetricsStore(100)
	if s == nil {
		t.Fatal("expected non-nil store")
	}
	if s.maxSize != 100 {
		t.Errorf("expected maxSize=100, got %d", s.maxSize)
	}
	if len(s.points) != 0 {
		t.Errorf("expected empty store, got %d points", len(s.points))
	}
}

// --- MetricsStore: Add ---

func TestStore_Add_Single(t *testing.T) {
	t.Parallel()
	s := NewMetricsStore(10)
	s.Add(MetricsPoint{Timestamp: time.Now(), CPU: 50})
	if len(s.points) != 1 {
		t.Errorf("expected 1 point, got %d", len(s.points))
	}
}

func TestStore_Add_RingBuffer(t *testing.T) {
	t.Parallel()
	maxSize := 3
	s := NewMetricsStore(maxSize)
	base := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	for i := 0; i < maxSize+2; i++ {
		s.Add(MetricsPoint{Timestamp: base.Add(time.Duration(i) * time.Second), CPU: float64(i)})
	}
	if len(s.points) != maxSize {
		t.Errorf("expected %d points after overflow, got %d", maxSize, len(s.points))
	}
	// Oldest 2 should be evicted; remaining points have CPU: 2, 3, 4
	if s.points[0].CPU != 2 {
		t.Errorf("expected oldest remaining CPU=2, got %f", s.points[0].CPU)
	}
	if s.points[maxSize-1].CPU != float64(maxSize+1) {
		t.Errorf("expected newest CPU=%d, got %f", maxSize+1, s.points[maxSize-1].CPU)
	}
}

func TestStore_Add_ExactCapacity(t *testing.T) {
	t.Parallel()
	maxSize := 5
	s := NewMetricsStore(maxSize)
	base := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	for i := 0; i < maxSize; i++ {
		s.Add(MetricsPoint{Timestamp: base.Add(time.Duration(i) * time.Second)})
	}
	if len(s.points) != maxSize {
		t.Errorf("expected %d points at capacity, got %d", maxSize, len(s.points))
	}
}

// --- MetricsStore: GetLatest ---

func TestStore_GetLatest_Empty(t *testing.T) {
	t.Parallel()
	s := NewMetricsStore(10)
	if got := s.GetLatest(); got != nil {
		t.Errorf("expected nil for empty store, got %v", got)
	}
}

func TestStore_GetLatest_Single(t *testing.T) {
	t.Parallel()
	s := NewMetricsStore(10)
	s.Add(MetricsPoint{Timestamp: time.Now(), CPU: 42})
	got := s.GetLatest()
	if got == nil {
		t.Fatal("expected non-nil")
	}
	if got.CPU != 42 {
		t.Errorf("expected CPU=42, got %f", got.CPU)
	}
}

func TestStore_GetLatest_Multiple(t *testing.T) {
	t.Parallel()
	s := NewMetricsStore(10)
	base := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	s.Add(MetricsPoint{Timestamp: base, CPU: 10})
	s.Add(MetricsPoint{Timestamp: base.Add(time.Second), CPU: 20})
	s.Add(MetricsPoint{Timestamp: base.Add(2 * time.Second), CPU: 30})
	got := s.GetLatest()
	if got == nil {
		t.Fatal("expected non-nil")
	}
	if got.CPU != 30 {
		t.Errorf("expected newest CPU=30, got %f", got.CPU)
	}
}

func TestStore_GetLatest_ReturnsCopy(t *testing.T) {
	t.Parallel()
	s := NewMetricsStore(10)
	s.Add(MetricsPoint{Timestamp: time.Now(), CPU: 99})
	got := s.GetLatest()
	got.CPU = 0 // mutate the returned value
	// Original store point should be unchanged
	if s.points[0].CPU != 99 {
		t.Error("GetLatest should return a copy, not a pointer to the stored value")
	}
}

// --- MetricsStore: GetRange ---

func TestStore_GetRange_EmptyStore(t *testing.T) {
	t.Parallel()
	s := NewMetricsStore(10)
	result := s.GetRange(time.Minute)
	if result == nil {
		t.Error("expected non-nil slice, not nil")
	}
	if len(result) != 0 {
		t.Errorf("expected 0 points, got %d", len(result))
	}
}

func TestStore_GetRange_AllInRange(t *testing.T) {
	t.Parallel()
	s := NewMetricsStore(10)
	now := time.Now()
	s.Add(MetricsPoint{Timestamp: now.Add(-10 * time.Second)})
	s.Add(MetricsPoint{Timestamp: now.Add(-5 * time.Second)})
	s.Add(MetricsPoint{Timestamp: now})
	result := s.GetRange(time.Minute)
	if len(result) != 3 {
		t.Errorf("expected 3 points in range, got %d", len(result))
	}
}

func TestStore_GetRange_Partial(t *testing.T) {
	t.Parallel()
	s := NewMetricsStore(10)
	now := time.Now()
	s.Add(MetricsPoint{Timestamp: now.Add(-2 * time.Minute), CPU: 1}) // outside window
	s.Add(MetricsPoint{Timestamp: now.Add(-30 * time.Second), CPU: 2}) // inside
	s.Add(MetricsPoint{Timestamp: now, CPU: 3})                        // inside
	result := s.GetRange(time.Minute)
	if len(result) != 2 {
		t.Errorf("expected 2 points in range, got %d", len(result))
	}
	for _, p := range result {
		if p.CPU == 1 {
			t.Error("expired point should not be included in range result")
		}
	}
}

func TestStore_GetRange_NoneInRange(t *testing.T) {
	t.Parallel()
	s := NewMetricsStore(10)
	s.Add(MetricsPoint{Timestamp: time.Now().Add(-10 * time.Minute)})
	result := s.GetRange(time.Minute)
	if len(result) != 0 {
		t.Errorf("expected 0 points, got %d", len(result))
	}
}

// --- Downsample ---

func TestDownsample_Empty(t *testing.T) {
	t.Parallel()
	result := Downsample(nil, time.Minute)
	if len(result) != 0 {
		t.Errorf("expected empty result, got %d points", len(result))
	}
}

func TestDownsample_SinglePoint(t *testing.T) {
	t.Parallel()
	base := time.Date(2024, 1, 1, 12, 0, 30, 0, time.UTC)
	points := []MetricsPoint{
		{Timestamp: base, CPU: 50, Memory: 60, Network: 1, Disk: 40},
	}
	result := Downsample(points, time.Minute)
	if len(result) != 1 {
		t.Fatalf("expected 1 bucket, got %d", len(result))
	}
	got := result[0]
	if got.CPU != 50 || got.Memory != 60 || got.Network != 1 || got.Disk != 40 {
		t.Errorf("unexpected values in single-point bucket: %+v", got)
	}
}

func TestDownsample_TimestampAtMidpoint(t *testing.T) {
	t.Parallel()
	// Both points fall in the 12:00 minute bucket.
	// Bucket start = 12:00:00, midpoint = 12:00:30.
	base := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
	points := []MetricsPoint{
		{Timestamp: base},
		{Timestamp: base.Add(30 * time.Second)},
	}
	result := Downsample(points, time.Minute)
	if len(result) != 1 {
		t.Fatalf("expected 1 bucket, got %d", len(result))
	}
	expected := base.Add(30 * time.Second) // bucketStart + interval/2
	if !result[0].Timestamp.Equal(expected) {
		t.Errorf("expected midpoint timestamp %v, got %v", expected, result[0].Timestamp)
	}
}

func TestDownsample_SingleBucket_AllFieldsAveraged(t *testing.T) {
	t.Parallel()
	base := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	points := []MetricsPoint{
		{Timestamp: base, CPU: 10, Memory: 20, Network: 30, Disk: 40},
		{Timestamp: base.Add(10 * time.Second), CPU: 30, Memory: 60, Network: 10, Disk: 80},
		{Timestamp: base.Add(20 * time.Second), CPU: 20, Memory: 40, Network: 20, Disk: 60},
	}
	result := Downsample(points, time.Minute)
	if len(result) != 1 {
		t.Fatalf("expected 1 bucket, got %d", len(result))
	}
	got := result[0]
	if got.CPU != 20 {
		t.Errorf("CPU: expected 20, got %f", got.CPU)
	}
	if got.Memory != 40 {
		t.Errorf("Memory: expected 40, got %f", got.Memory)
	}
	if got.Network != 20 {
		t.Errorf("Network: expected 20, got %f", got.Network)
	}
	if got.Disk != 60 {
		t.Errorf("Disk: expected 60, got %f", got.Disk)
	}
}

func TestDownsample_MultipleBuckets(t *testing.T) {
	t.Parallel()
	base := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	points := []MetricsPoint{
		{Timestamp: base, CPU: 10},                        // bucket 1
		{Timestamp: base.Add(30 * time.Second), CPU: 30},  // bucket 1
		{Timestamp: base.Add(time.Minute), CPU: 50},       // bucket 2
		{Timestamp: base.Add(90 * time.Second), CPU: 70},  // bucket 2
	}
	result := Downsample(points, time.Minute)
	if len(result) != 2 {
		t.Fatalf("expected 2 buckets, got %d", len(result))
	}
	if result[0].CPU != 20 {
		t.Errorf("bucket 1 CPU: expected 20, got %f", result[0].CPU)
	}
	if result[1].CPU != 60 {
		t.Errorf("bucket 2 CPU: expected 60, got %f", result[1].CPU)
	}
}

// --- Concurrency ---

func TestStore_Concurrent(t *testing.T) {
	t.Parallel()
	s := NewMetricsStore(100)
	var wg sync.WaitGroup
	const goroutines = 10
	const ops = 50
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < ops; j++ {
				s.Add(MetricsPoint{Timestamp: time.Now(), CPU: float64(j)})
				_ = s.GetLatest()
				_ = s.GetRange(time.Minute)
			}
		}()
	}
	wg.Wait()
}
