package collectors

import (
	"sync"
	"time"
)

// MetricsPoint represents a single metrics sample.
type MetricsPoint struct {
	Timestamp time.Time `json:"timestamp"`
	CPU       float64   `json:"cpu"`
	Memory    float64   `json:"memory"`
	Network   float64   `json:"network"`
	Disk      float64   `json:"disk"`
}

// MetricsStore is a thread-safe in-memory ring buffer for metrics data.
type MetricsStore struct {
	mu       sync.RWMutex
	points   []MetricsPoint
	maxSize  int
}

// NewMetricsStore creates a store that retains up to maxSize data points.
func NewMetricsStore(maxSize int) *MetricsStore {
	return &MetricsStore{
		points:  make([]MetricsPoint, 0, maxSize),
		maxSize: maxSize,
	}
}

// Add appends a new metrics point, evicting the oldest if at capacity.
func (s *MetricsStore) Add(p MetricsPoint) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.points) >= s.maxSize {
		s.points = s.points[1:]
	}
	s.points = append(s.points, p)
}

// GetLatest returns the most recent metrics point, or nil if empty.
func (s *MetricsStore) GetLatest() *MetricsPoint {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if len(s.points) == 0 {
		return nil
	}
	p := s.points[len(s.points)-1]
	return &p
}

// GetRange returns all points within the given duration from now.
func (s *MetricsStore) GetRange(d time.Duration) []MetricsPoint {
	s.mu.RLock()
	defer s.mu.RUnlock()

	cutoff := time.Now().Add(-d)
	result := make([]MetricsPoint, 0)
	for _, p := range s.points {
		if !p.Timestamp.Before(cutoff) {
			result = append(result, p)
		}
	}
	return result
}

// Downsample averages points into buckets of the given interval.
func Downsample(points []MetricsPoint, interval time.Duration) []MetricsPoint {
	if len(points) == 0 {
		return points
	}

	var result []MetricsPoint
	bucketStart := points[0].Timestamp.Truncate(interval)
	var sumCPU, sumMem, sumNet float64
	var count int

	flush := func() {
		if count > 0 {
			result = append(result, MetricsPoint{
				Timestamp: bucketStart.Add(interval / 2),
				CPU:       sumCPU / float64(count),
				Memory:    sumMem / float64(count),
				Network:   sumNet / float64(count),
			})
		}
	}

	for _, p := range points {
		bucket := p.Timestamp.Truncate(interval)
		if bucket != bucketStart {
			flush()
			bucketStart = bucket
			sumCPU, sumMem, sumNet = 0, 0, 0
			count = 0
		}
		sumCPU += p.CPU
		sumMem += p.Memory
		sumNet += p.Network
		count++
	}
	flush()

	return result
}
