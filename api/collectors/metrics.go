package collectors

import (
	"context"
	"log"
	"math"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
)

const (
	// Collect every 5 seconds, keep 7 days of samples.
	CollectInterval = 5 * time.Second
	MaxStoreSize    = 7 * 24 * 60 * 60 / 5 // ~120,960
)

// MetricsCollector gathers system metrics on a timer and stores them.
type MetricsCollector struct {
	Store         *MetricsStore
	prevNetBytes  uint64
	prevNetTime   time.Time
	hasBaseline   bool
}

// NewMetricsCollector creates a collector with its own store.
func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{
		Store: NewMetricsStore(MaxStoreSize),
	}
}

// Start begins collecting metrics in a background goroutine.
func (c *MetricsCollector) Start(ctx context.Context) {
	// Collect once immediately so /current has data right away.
	c.collectOnce()

	go func() {
		ticker := time.NewTicker(CollectInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				c.collectOnce()
			}
		}
	}()
}

func (c *MetricsCollector) collectOnce() {
	now := time.Now()

	cpuPct := c.collectCPU()
	memPct := c.collectMemory()
	netMBs := c.collectNetwork(now)
	diskPct := c.collectDisk()

	c.Store.Add(MetricsPoint{
		Timestamp: now,
		CPU:       round2(cpuPct),
		Memory:    round2(memPct),
		Network:   round2(netMBs),
		Disk:      round2(diskPct),
	})
}

func (c *MetricsCollector) collectCPU() float64 {
	percentages, err := cpu.Percent(0, false)
	if err != nil || len(percentages) == 0 {
		log.Printf("cpu collect error: %v", err)
		return 0
	}
	return percentages[0]
}

func (c *MetricsCollector) collectMemory() float64 {
	v, err := mem.VirtualMemory()
	if err != nil {
		log.Printf("memory collect error: %v", err)
		return 0
	}
	return v.UsedPercent
}

func (c *MetricsCollector) collectNetwork(now time.Time) float64 {
	counters, err := net.IOCounters(false)
	if err != nil || len(counters) == 0 {
		log.Printf("network collect error: %v", err)
		return 0
	}

	totalBytes := counters[0].BytesSent + counters[0].BytesRecv

	if !c.hasBaseline {
		c.prevNetBytes = totalBytes
		c.prevNetTime = now
		c.hasBaseline = true
		return 0
	}

	elapsed := now.Sub(c.prevNetTime).Seconds()
	if elapsed <= 0 {
		return 0
	}

	if totalBytes < c.prevNetBytes {
		// Counter reset or wrap-around detected; re-baseline and skip this sample.
		c.prevNetBytes = totalBytes
		c.prevNetTime = now
		return 0
	}

	deltaBytes := totalBytes - c.prevNetBytes
	mbPerSec := float64(deltaBytes) / elapsed / (1024 * 1024)

	c.prevNetBytes = totalBytes
	c.prevNetTime = now

	return mbPerSec
}

func (c *MetricsCollector) collectDisk() float64 {
	usage, err := disk.Usage("/")
	if err != nil {
		log.Printf("disk collect error: %v", err)
		return 0
	}
	return usage.UsedPercent
}

func round2(f float64) float64 {
	return math.Round(f*100) / 100
}
