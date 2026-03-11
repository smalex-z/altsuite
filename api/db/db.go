package db

import (
	"database/sql"
	"errors"
	"time"

	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// ErrDuplicateUsername is returned when creating a user with an existing username.
var ErrDuplicateUsername = errors.New("username already exists")

// User is a stored user (password hash never returned to API).
type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"created_at"`
}

const bcryptCost = 10

const schema = `
CREATE TABLE IF NOT EXISTS users (
	id BIGSERIAL PRIMARY KEY,
	username TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (username);
`

// DB wraps the database connection and provides user operations.
type DB struct {
	*sql.DB
}

// Open connects to Postgres and runs migrations. databaseURL format: postgres://user:pass@host:5432/dbname?sslmode=disable
func Open(databaseURL string) (*DB, error) {
	if databaseURL == "" {
		return nil, errors.New("database URL is required")
	}
	conn, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, err
	}
	if err := conn.Ping(); err != nil {
		conn.Close()
		return nil, err
	}
	d := &DB{conn}
	if _, err := d.Exec(schema); err != nil {
		d.Close()
		return nil, err
	}
	return d, nil
}

// ListUsers returns all users (no password hashes).
func (d *DB) ListUsers() ([]User, error) {
	rows, err := d.Query(`SELECT id, username, created_at FROM users ORDER BY username`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := make([]User, 0)
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// CreateUser creates a new user with the given password (stored as bcrypt hash).
func (d *DB) CreateUser(username, password string) (*User, error) {
	if username == "" || password == "" {
		return nil, errors.New("username and password are required")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return nil, err
	}
	var u User
	err = d.QueryRow(
		`INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at`,
		username, string(hash),
	).Scan(&u.ID, &u.Username, &u.CreatedAt)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return nil, ErrDuplicateUsername
		}
		return nil, err
	}
	return &u, nil
}

// GetUserByID returns a user by ID, or nil if not found.
func (d *DB) GetUserByID(id int64) (*User, error) {
	var u User
	err := d.QueryRow(`SELECT id, username, created_at FROM users WHERE id = $1`, id).Scan(&u.ID, &u.Username, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// UpdatePassword sets a new password for the user (by ID).
func (d *DB) UpdatePassword(id int64, newPassword string) error {
	if newPassword == "" {
		return errors.New("new password is required")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcryptCost)
	if err != nil {
		return err
	}
	res, err := d.Exec(`UPDATE users SET password_hash = $1 WHERE id = $2`, string(hash), id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errors.New("user not found")
	}
	return nil
}
