package db

import (
	"os"
	"strconv"
	"testing"
	"time"
)

func testDB(t *testing.T) *DB {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set (required for user management tests)")
	}
	d, err := Open(url)
	if err != nil {
		t.Fatalf("open test DB: %v", err)
	}
	t.Cleanup(func() { d.Close() })
	return d
}

func TestOpen_EmptyURL(t *testing.T) {
	_, err := Open("")
	if err == nil {
		t.Error("expected error for empty database URL")
	}
}

func TestListUsers_Succeeds(t *testing.T) {
	d := testDB(t)
	users, err := d.ListUsers()
	if err != nil {
		t.Fatalf("ListUsers: %v", err)
	}
	if users == nil {
		t.Error("ListUsers: expected non-nil slice")
	}
}

func uniqueUsername(t *testing.T, prefix string) string {
	return prefix + "_" + strconv.FormatInt(time.Now().UnixNano(), 10)
}

func TestCreateUser(t *testing.T) {
	d := testDB(t)
	u, err := d.CreateUser(uniqueUsername(t, "creat"), "testpass123")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if u.ID <= 0 {
		t.Errorf("expected positive ID, got %d", u.ID)
	}
	if u.Username == "" {
		t.Error("expected non-empty username")
	}
	if u.CreatedAt.IsZero() {
		t.Error("expected CreatedAt to be set")
	}
}

func TestCreateUser_EmptyUsername(t *testing.T) {
	d := testDB(t)
	_, err := d.CreateUser("", "pass")
	if err == nil {
		t.Error("expected error for empty username")
	}
}

func TestCreateUser_EmptyPassword(t *testing.T) {
	d := testDB(t)
	_, err := d.CreateUser("u", "")
	if err == nil {
		t.Error("expected error for empty password")
	}
}

func TestCreateUser_DuplicateUsername(t *testing.T) {
	d := testDB(t)
	name := uniqueUsername(t, "dup")
	_, err := d.CreateUser(name, "pass1")
	if err != nil {
		t.Fatalf("first CreateUser: %v", err)
	}
	_, err = d.CreateUser(name, "pass2")
	if err != ErrDuplicateUsername {
		t.Errorf("expected ErrDuplicateUsername, got %v", err)
	}
}

func TestListUsers_AfterCreate(t *testing.T) {
	d := testDB(t)
	name := uniqueUsername(t, "list")
	_, err := d.CreateUser(name, "pass")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	users, err := d.ListUsers()
	if err != nil {
		t.Fatalf("ListUsers: %v", err)
	}
	var found bool
	for _, u := range users {
		if u.Username == name {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("ListUsers: did not find %q in %v", name, users)
	}
}

func TestGetUserByID(t *testing.T) {
	d := testDB(t)
	name := uniqueUsername(t, "getbyid")
	created, err := d.CreateUser(name, "pass")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	u, err := d.GetUserByID(created.ID)
	if err != nil {
		t.Fatalf("GetUserByID: %v", err)
	}
	if u == nil {
		t.Fatal("GetUserByID: expected user, got nil")
	}
	if u.ID != created.ID || u.Username != name {
		t.Errorf("GetUserByID: got %+v", u)
	}
}

func TestGetUserByID_NotFound(t *testing.T) {
	d := testDB(t)
	u, err := d.GetUserByID(999999)
	if err != nil {
		t.Fatalf("GetUserByID: %v", err)
	}
	if u != nil {
		t.Errorf("expected nil for missing user, got %+v", u)
	}
}

func TestUpdatePassword(t *testing.T) {
	d := testDB(t)
	name := uniqueUsername(t, "chgpw")
	created, err := d.CreateUser(name, "oldpass")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	err = d.UpdatePassword(created.ID, "newpass")
	if err != nil {
		t.Fatalf("UpdatePassword: %v", err)
	}
	// User should still be fetchable
	u, err := d.GetUserByID(created.ID)
	if err != nil || u == nil {
		t.Fatalf("GetUserByID after UpdatePassword: %v", err)
	}
	if u.Username != name {
		t.Errorf("username changed: %q", u.Username)
	}
}

func TestUpdatePassword_EmptyPassword(t *testing.T) {
	d := testDB(t)
	created, err := d.CreateUser(uniqueUsername(t, "emptynewpw"), "pass")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	err = d.UpdatePassword(created.ID, "")
	if err == nil {
		t.Error("expected error for empty new password")
	}
}

func TestUpdatePassword_NotFound(t *testing.T) {
	d := testDB(t)
	err := d.UpdatePassword(999999, "newpass")
	if err == nil {
		t.Error("expected error for non-existent user")
	}
	if err != nil && err.Error() != "user not found" {
		t.Errorf("expected 'user not found', got %v", err)
	}
}
