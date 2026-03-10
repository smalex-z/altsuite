package collectors

import (
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
)

// SystemReader abstracts the OS-level metric reads performed by MetricsCollector.
// The interface exists to enable unit testing via mock implementations.
type SystemReader interface {
	CPUPercent() (float64, error)
	MemoryPercent() (float64, error)
	NetworkBytes() (uint64, error)
	DiskPercent(path string) (float64, error)
}

// gopsutilReader is the production SystemReader backed by gopsutil.
type gopsutilReader struct{}

func newGopsutilReader() SystemReader {
	return &gopsutilReader{}
}

func (r *gopsutilReader) CPUPercent() (float64, error) {
	percentages, err := cpu.Percent(0, false)
	if err != nil || len(percentages) == 0 {
		return 0, err
	}
	return percentages[0], nil
}

func (r *gopsutilReader) MemoryPercent() (float64, error) {
	v, err := mem.VirtualMemory()
	if err != nil {
		return 0, err
	}
	return v.UsedPercent, nil
}

func (r *gopsutilReader) NetworkBytes() (uint64, error) {
	counters, err := net.IOCounters(false)
	if err != nil || len(counters) == 0 {
		return 0, err
	}
	return counters[0].BytesSent + counters[0].BytesRecv, nil
}

func (r *gopsutilReader) DiskPercent(path string) (float64, error) {
	usage, err := disk.Usage(path)
	if err != nil {
		return 0, err
	}
	return usage.UsedPercent, nil
}
