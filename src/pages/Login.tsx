import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth, setRole, type Role } from "../auth";

import ajwaadImg from "../assets/team/ajwaad.jpg";
import aryanImg from "../assets/team/aryan.jpg";
import esmeImg from "../assets/team/esme.jpg";
import karimImg from "../assets/team/karim.jpg";
import matthewImg from "../assets/team/matthew.jpg";
import nathanImg from "../assets/team/nathan.jpg";
import salehImg from "../assets/team/saleh.jpg";
import sandyImg from "../assets/team/sandy.jpg";

type ViewMode = "login" | "team";

type TeamMember = {
  name: string;
  role: string;
  image: string;
  linkedin: string;
};

const TEAM_MEMBERS: TeamMember[] = [
  {
    name: "Karim Ali",
    role: "Co-Project Manager",
    image: karimImg,
    linkedin: "https://www.linkedin.com/in/karim-ali-960a0927b/",
  },
  {
    name: "Saleh Abdelrahman",
    role: "Co-Project Manager",
    image: salehImg,
    linkedin: "https://www.linkedin.com/in/saleh-abdelrahman-79a6ba18b/",
  },
  {
    name: "Matthew Lones",
    role: "Design Team Member",
    image: matthewImg,
    linkedin: "https://www.linkedin.com/in/matthew-lones/",
  },
  {
    name: "Sandy Mourad",
    role: "Design Team Member",
    image: sandyImg,
    linkedin: "https://www.linkedin.com/in/sandy-mourad/",
  },
  {
    name: "Ajwaad Khan",
    role: "Design Team Member",
    image: ajwaadImg,
    linkedin: "https://www.linkedin.com/in/ajwaad-khan-97440a2b1/",
  },
  {
    name: "Aryan Ahlawat",
    role: "Design Team Member",
    image: aryanImg,
    linkedin: "https://www.linkedin.com/in/aryan-ahlawat-82912b29a/",
  },
  {
    name: "Nathan Cai",
    role: "Design Team Member",
    image: nathanImg,
    linkedin: "https://www.linkedin.com/in/nathan-cai-dev/",
  },
  {
    name: "Esme Mirchandani",
    role: "Design Team Member",
    image: esmeImg,
    linkedin: "https://www.linkedin.com/in/esmemirchandani/",
  },
];

export default function Login() {
  const navigate = useNavigate();

  const [view, setView] = useState<ViewMode>("login");
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

  const goToLoginHome = () => {
    setView("login");
  };

  const goToDemo = () => {
    clearAuth();
    setRole("user");
    navigate("/user");
  };

  const goToMeetTheTeam = () => {
    setView("team");
  };

  return (
    <div className="ai-page-bg flex items-center justify-center p-6">
      <div className="ai-card w-full max-w-6xl p-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goToLoginHome}
            className="font-bold text-xl tracking-tight text-left"
          >
            Ai4Support <span className="text-ai-gold">Portal</span>
          </button>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={goToDemo}
              className="text-sm text-ai-gold hover:underline"
            >
              Demo
            </button>

            <button
              type="button"
              onClick={goToMeetTheTeam}
              className="text-sm text-ai-gold hover:underline"
            >
              Meet the team
            </button>
          </div>
        </div>

        {/* LOGIN VIEW */}
        {view === "login" && (
          <>
            {/* STEP 1 — ROLE SELECTION */}
            {!role && (
              <>
                <h1 className="text-3xl font-bold mt-8">Login</h1>
                <p className="text-ai-muted mt-2">Choose a role to continue.</p>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    className="ai-btn-secondary !justify-start text-left w-full py-5"
                    onClick={() => setSelectedRole("user")}
                  >
                    <div>
                      <div className="font-semibold">Continue as User</div>
                      <div className="text-sm text-ai-muted mt-1">Chatbot access</div>
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

                  {error && <div className="text-sm text-red-400">{error}</div>}

                  <button className="ai-btn-primary w-full" onClick={handleLogin}>
                    Login
                  </button>

                  <button className="ai-btn-secondary w-full" onClick={resetToRoleSelection}>
                    ← Back
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* MEET THE TEAM VIEW */}
        {view === "team" && (
          <>
            <div className="mt-8 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">Meet the Team</h1>
                <p className="text-ai-muted mt-2">
                  Click a profile to open that team member’s LinkedIn.
                </p>
              </div>

              <button
                type="button"
                onClick={goToLoginHome}
                className="ai-btn-secondary shrink-0"
              >
                ← Back to login
              </button>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {TEAM_MEMBERS.map((member) => (
                <a
                  key={member.name}
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center text-center bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition"
                >
                  <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-white/10 group-hover:border-ai-gold transition shadow-lg">
                    <img
                      src={member.image}
                      alt={member.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="mt-4 text-lg font-semibold">{member.name}</div>
                  <div className="mt-1 text-sm text-ai-muted">{member.role}</div>
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}