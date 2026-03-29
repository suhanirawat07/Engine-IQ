import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../firebase/config";
import api from "../services/api";

const AuthContext = createContext(null);

const toAppUser = (firebaseUser, role = "user") => ({
  uid: firebaseUser.uid,
  email: firebaseUser.email,
  displayName: firebaseUser.displayName,
  photoURL: firebaseUser.photoURL,
  role,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(toAppUser(firebaseUser, "user"));

        // Fire and forget sync; update role when backend responds.
        api
          .post(
            "/users/sync",
            {
              googleId: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
            },
            { timeout: 30000 }
          )
          .then((res) => {
            const role = res?.data?.user?.role || "user";
            setUser((prev) => {
              if (!prev || prev.uid !== firebaseUser.uid) return prev;
              return { ...prev, role };
            });
          })
          .catch((e) => console.warn("User sync failed:", e.message));
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
