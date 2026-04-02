/**
 * Code Compression Benchmark
 * Measures actual token savings for TS/Py/Go code samples.
 */

import { Pipeline } from '../../src/optimizer/pipeline/pipeline';
import { ToonCompressor } from '../../src/optimizer/compressors/toon';
import { CodeCompressor } from '../../src/optimizer/compressors/code';
import { MultilingualTokenizer } from '../../src/optimizer/multilingual/index';

const tokenizer = new MultilingualTokenizer('gpt-4', true);
const pipeline = new Pipeline(tokenizer);
pipeline.register(new ToonCompressor());
pipeline.register(new CodeCompressor());

const SAMPLES = {
  'TypeScript (heavily commented)': `
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FC, ReactNode } from 'react';
import { useRouter } from '../../../../lib/router/hooks';
import { api } from '../../../../utils/api/client';
import { formatDate } from '../../../../utils/date/formatter';
import { useAuth } from '../../../../hooks/auth/useAuth';
import { trackEvent } from '../../../../analytics/tracker';

// ==============================================
// User Profile Component
// Author: Dev Team
// Created: 2024-01-01
// Updated: 2024-06-15
// ==============================================

/**
 * UserProfile - displays and manages user profile information
 * Handles data fetching, state management, and form submissions
 */
interface UserProfileProps {
  userId: string;
  showAvatar: boolean;
  onUpdate?: (user: UserData) => void; // callback when profile is updated
}

// Type definitions for user data
interface UserData {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  createdAt: Date;
}

// Main component
export const UserProfile: FC<UserProfileProps> = ({ userId, showAvatar, onUpdate }) => {
  // State management
  const [user, setUser] = useState<UserData | null>(null); // current user data
  const [loading, setLoading] = useState(true); // loading state
  const [error, setError] = useState<string | null>(null); // error message

  // Hooks
  const router = useRouter(); // navigation
  const { token } = useAuth(); // auth token

  // Fetch user data on mount
  useEffect(() => {
    // Start fetching
    const fetchUser = async () => {
      try {
        setLoading(true); // start loading
        const data = await api.get(\`/users/\${userId}\`); // API call
        setUser(data); // set user data
        setError(null); // clear error
      } catch (err) {
        setError('Failed to load user'); // set error message
        console.error(err); // log error
      } finally {
        setLoading(false); // stop loading
      }
    };

    fetchUser(); // execute
  }, [userId]); // re-run when userId changes

  // Handle form submission
  const handleSubmit = useCallback(async (formData: Partial<UserData>) => {
    try {
      const updated = await api.put(\`/users/\${userId}\`, formData); // update API
      setUser(updated); // update state
      onUpdate?.(updated); // notify parent
      trackEvent('profile_updated'); // analytics
    } catch (err) {
      setError('Failed to update'); // error handling
    }
  }, [userId, onUpdate]); // dependencies

  // Memoize formatted date
  const formattedDate = useMemo(() => {
    return user ? formatDate(user.createdAt) : ''; // format date
  }, [user]); // re-compute when user changes

  // Render loading state
  if (loading) return <div>Loading...</div>;

  // Render error state
  if (error) return <div>Error: {error}</div>;

  // Render profile
  return (
    <div className="profile">
      {showAvatar && <img src={user?.avatar} alt="avatar" />}
      <h1>{user?.name}</h1>
      <p>{user?.email}</p>
      <p>Member since: {formattedDate}</p>
    </div>
  );
};
`,

  'Python (class with docstrings)': `
from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import logging
import json
import os

# ==============================================
# User Service API
# Author: Backend Team
# Version: 2.1.0
# ==============================================

# Initialize logging
logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///users.db')
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
Base = declarative_base()


class User(Base):
    """User model for the database.

    Stores basic user information including name, email,
    and role. Supports CRUD operations through the UserService.

    Attributes:
        id: Primary key
        name: User's full name
        email: User's email address
        role: User's role (admin/user/viewer)
    """
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)  # auto-increment
    name = Column(String(100), nullable=False)  # required
    email = Column(String(200), unique=True, nullable=False)  # unique email
    role = Column(String(50), default='user')  # default role


class UserService:
    """Service layer for user operations.

    Provides methods for creating, reading, updating,
    and deleting users. Handles database sessions and
    error handling.
    """

    def __init__(self):
        """Initialize the service with a database session."""
        self.session = Session()

    def get_all(self):
        """Get all users from the database.

        Returns:
            list: List of User objects
        """
        # Query all users
        users = self.session.query(User).all()
        return users

    def get_by_id(self, user_id):
        """Get a user by their ID.

        Args:
            user_id: The user's primary key

        Returns:
            User: The user object, or None
        """
        # Find user by primary key
        user = self.session.query(User).get(user_id)
        return user

    def create(self, name, email, role='user'):
        """Create a new user.

        Args:
            name: User's full name
            email: User's email address
            role: User's role (default: 'user')

        Returns:
            User: The created user object

        Raises:
            ValueError: If email already exists
        """
        # Check for duplicate email
        existing = self.session.query(User).filter_by(email=email).first()
        if existing:
            raise ValueError(f"Email {email} already exists")  # duplicate check

        # Create new user
        user = User(name=name, email=email, role=role)
        self.session.add(user)  # add to session
        self.session.commit()  # persist to database
        logger.info(f"Created user: {user.name}")  # log creation
        return user

    def delete(self, user_id):
        """Delete a user by their ID.

        Args:
            user_id: The user's primary key

        Returns:
            bool: True if deleted, False if not found
        """
        # Find and delete
        user = self.get_by_id(user_id)
        if not user:
            return False  # not found

        self.session.delete(user)  # remove from session
        self.session.commit()  # persist deletion
        logger.info(f"Deleted user: {user_id}")  # log deletion
        return True  # success
`,

  'Go (HTTP handler)': `package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ==============================================
// User API Handler
// Author: Go Team
// Version: 1.0.0
// ==============================================

// User represents a user in the system
type User struct {
	ID        int       \`json:"id"\`        // unique identifier
	Name      string    \`json:"name"\`      // full name
	Email     string    \`json:"email"\`     // email address
	Role      string    \`json:"role"\`      // user role
	CreatedAt time.Time \`json:"createdAt"\` // creation timestamp
}

// UserStore provides thread-safe user storage
type UserStore struct {
	mu    sync.RWMutex // protects users map
	users map[int]*User // user storage
	nextID int          // auto-increment counter
}

// NewUserStore creates a new user store
func NewUserStore() *UserStore {
	return &UserStore{
		users:  make(map[int]*User),
		nextID: 1, // start from 1
	}
}

// GetAll returns all users
func (s *UserStore) GetAll() []*User {
	s.mu.RLock()         // read lock
	defer s.mu.RUnlock() // release lock

	// Collect all users
	result := make([]*User, 0, len(s.users))
	for _, u := range s.users {
		result = append(result, u) // add to result
	}
	return result
}

// GetByID returns a user by ID
func (s *UserStore) GetByID(id int) (*User, error) {
	s.mu.RLock()         // read lock
	defer s.mu.RUnlock() // release lock

	// Look up user
	user, ok := s.users[id]
	if !ok {
		return nil, fmt.Errorf("user %d not found", id) // not found
	}
	return user, nil // found
}

// Create adds a new user
func (s *UserStore) Create(name, email, role string) *User {
	s.mu.Lock()         // write lock
	defer s.mu.Unlock() // release lock

	// Create user with auto-increment ID
	user := &User{
		ID:        s.nextID,
		Name:      name,
		Email:     email,
		Role:      role,
		CreatedAt: time.Now(), // current time
	}
	s.users[user.ID] = user // store user
	s.nextID++              // increment counter
	log.Printf("Created user: %s (%d)", name, user.ID) // log
	return user
}

// HandleUsers is the HTTP handler for /api/users
func (s *UserStore) HandleUsers(w http.ResponseWriter, r *http.Request) {
	// Set content type
	w.Header().Set("Content-Type", "application/json")

	// Route by method
	switch r.Method {
	case http.MethodGet:
		// List all users
		users := s.GetAll()
		json.NewEncoder(w).Encode(users) // encode response

	case http.MethodPost:
		// Create new user
		var input struct {
			Name  string \`json:"name"\`
			Email string \`json:"email"\`
			Role  string \`json:"role"\`
		}
		// Decode request body
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest) // bad request
			return
		}
		// Validate required fields
		if input.Name == "" || input.Email == "" {
			http.Error(w, "name and email required", http.StatusBadRequest) // validation
			return
		}
		// Create user
		user := s.Create(input.Name, input.Email, input.Role)
		w.WriteHeader(http.StatusCreated) // 201
		json.NewEncoder(w).Encode(user)   // encode response

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed) // 405
	}
}

func main() {
	store := NewUserStore()
	// Register routes
	http.HandleFunc("/api/users", store.HandleUsers)
	// Start server
	fmt.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil)) // blocks
}
`,
};

console.log('=== Code Compression Benchmark ===\n');

for (const [label, code] of Object.entries(SAMPLES)) {
  const originalTokens = tokenizer.countBase(code);
  const result = pipeline.run(code, 1); // Very low threshold to always show results

  if (result.optimized) {
    const savings = result.savings!;
    const layers = result.compressMetadata?.layers || [];
    console.log(`${label}:`);
    console.log(`  Original: ${originalTokens} tokens (${code.length} chars)`);
    console.log(`  Compressed: ${result.optimizedTokens} tokens (${result.content.length} chars)`);
    console.log(`  Savings: ${savings.tokens} tokens (${savings.percentage.toFixed(1)}%)`);
    console.log(`  Layers: ${layers.join(', ')}`);
    console.log();
  } else {
    console.log(`${label}: NOT OPTIMIZED — ${result.reason}`);
    console.log(`  Original: ${originalTokens} tokens (${code.length} chars)`);
    console.log();
  }
}

tokenizer.free();
