import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth, setRole, type Role } from "../auth";

export default function Login() {
  const navigate = useNavigate();

  const [role, setSelectedRole] = useState<Role | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    setError("");

    const isUser =
      role === "user" && email === "user@gmail.com" && password === "userchat";
    const isAdmin =
      role === "admin" &&
      email === "admin@gmail.com" &&
      password === "adminchat";

    if (isUser) {
      clearAuth();
      setRole("user");
      navigate("/user");
      return;
    }

    if (isAdmin) {
      clearAuth();
      setRole("admin");
      navigate("/admin");
      return;
    }

    setError("Invalid email or password");
  };

  const resetToRoleSelection = () => {
    setSelectedRole(null);
    setEmail("");
    setPassword("");
    setError("");
  };

  return (
    <div className="ai-page-bg flex items-center justify-center p-6">
      <div className="ai-card w-full max-w-xl p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="font-bold text-xl tracking-tight">
            Ai4Support <span className="text-ai-gold">Portal</span>
          </div>
          <div className="text-xs text-ai-muted">UI-only prototype</div>
        </div>

        {/* STEP 1 — ROLE SELECTION */}
        {!role && (
          <>
            <h1 className="text-3xl font-bold mt-8">Login</h1>
            <p className="text-ai-muted mt-2">
              Choose a role to continue.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                className="ai-btn-secondary !justify-start text-left w-full py-5"
                onClick={() => setSelectedRole("user")}
              >
                <div>
                  <div className="font-semibold">Continue as User</div>
                  <div className="text-sm text-ai-muted mt-1">
                    Chatbot access
                  </div>
                </div>
              </button>

              <button
                className="ai-btn-primary !justify-start text-left w-full py-5"
                onClick={() => setSelectedRole("admin")}
              >
                <div>
                  <div className="font-semibold">Continue as Admin</div>
                  <div className="text-sm opacity-80 mt-1">
                    Upload documents + chatbot
                  </div>
                </div>
              </button>
            </div>
          </>
        )}

        {/* STEP 2 — CREDENTIALS */}
        {role && (
          <>
            <h1 className="text-2xl font-bold mt-8">
              {role === "user" ? "User Login" : "Admin Login"}
            </h1>
            <p className="text-ai-muted mt-2 text-sm">
              Enter credentials to continue.
            </p>

            <div className="mt-6 space-y-4">
              <input
                type="email"
                placeholder="Email"
                className="ai-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />

              <input
                type="password"
                placeholder="Password"
                className="ai-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />

              {error && (
                <div className="text-sm text-red-400">{error}</div>
              )}

              <button className="ai-btn-primary w-full" onClick={handleLogin}>
                Login
              </button>

              <button
                className="ai-btn-secondary w-full"
                onClick={resetToRoleSelection}
              >
                ← Back
              </button>
            </div>

            <div className="mt-6 text-xs text-ai-muted space-y-1">
              <div>
                User: <span className="text-ai-text">user@gmail.com / userchat</span>
              </div>
              <div>
                Admin: <span className="text-ai-text">admin@gmail.com / adminchat</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
