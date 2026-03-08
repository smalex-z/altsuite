package collectors

import (
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
