"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { cn } from "@/lib/utils";
import "./login.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("error");

  const showToast = (message: string, type: "success" | "error") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setPasswordError("");

    if (!email) {
      setEmailError("Email address is required");
      return;
    }
    if (!password) {
      setPasswordError("Password is required");
      return;
    }

    setIsLoading(true);

    try {
      const data = await login(email, password);

      // Store user info (No JWT)
      localStorage.setItem("user_role", data.role);
      localStorage.setItem("user_id", data.user_id);
      localStorage.setItem("user_email", data.email);

      showToast("Login successful! Redirecting...", "success");

      // Decode token to get user ID if needed, or backend returns it? 
      // Backend returns Redirect URL, usually "/dashboard" or "/student-dashboard"
      router.push(data.redirect);

    } catch (error: any) {
      console.error("Login error:", error);
      showToast(error.message || "Invalid email or password", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Login Page */}
      <div className="page active">
        {/* Animated Grid Pattern Background */}
        <AnimatedGridPattern
          numSquares={30}
          maxOpacity={0.4}
          duration={3}
          repeatDelay={1}
          className={cn(
            "[mask-image:radial-gradient(1200px_circle_at_center,white,transparent)]",
            "inset-x-0 inset-y-[-30%] h-[200%] skew-y-12 absolute z-0"
          )}
        />

        <div className="login-layout">
          {/* Left Side: Branding / Project Representation */}
          <div className="brand-section">
            <div className="brand-content">
              <div className="brand-logo">
                <img src="/kclas-removebg-preview.png" alt="KCLAS Logo" className="logo-image-large" />
                <div className="logo-text-large">
                  <h1>KCLAS</h1>
                  <span>Platform</span>
                </div>
              </div>

              <h1 className="brand-headline">The Future of Assessment</h1>
              <p className="brand-description">
                Experience an intelligent ecosystem designed to generate, evaluate, and adapt. Elevating the standard of education through AI.
              </p>

              <div className="dashboard-preview-container">
                <div className="mockup-window glass-morphism">
                  {/* Mockup Mac Header */}
                  <div className="mac-window-header mockup-header">
                    <div className="mac-dot close"></div>
                    <div className="mac-dot minimize"></div>
                    <div className="mac-dot maximize"></div>
                  </div>

                  {/* Mockup Content */}
                  <div className="mockup-body">
                    <div className="mockup-nav">
                      <div className="mockup-logo">
                        <div className="m-logo">K</div>
                        <div className="m-logo-text">
                          <div className="m-text-line m-title"></div>
                          <div className="m-text-line m-sub"></div>
                        </div>
                      </div>
                      <div className="m-theme-toggle"></div>
                    </div>

                    <div className="mockup-content-area">
                      <div className="m-hero">
                        <div className="m-hero-title"></div>
                        <div className="m-hero-sub"></div>
                      </div>

                      <div className="m-action-cards">
                        <div className="m-action-card">
                          <div className="m-icon-box m-blue"></div>
                          <div className="m-card-title"></div>
                          <div className="m-card-sub"></div>
                        </div>
                        <div className="m-action-card">
                          <div className="m-icon-box m-teal"></div>
                          <div className="m-card-title"></div>
                          <div className="m-card-sub"></div>
                        </div>
                      </div>

                      <div className="m-table-section">
                        <div className="m-table-header"></div>
                        <div className="m-table-row">
                          <div className="m-cell m-cell-1"></div>
                          <div className="m-cell m-cell-2"></div>
                          <div className="m-cell m-cell-3"></div>
                        </div>
                        <div className="m-table-row">
                          <div className="m-cell m-cell-1"></div>
                          <div className="m-cell m-cell-2"></div>
                          <div className="m-cell m-cell-3"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Login Form */}
          <div className="auth-section">
            <div className="auth-container">
              <div className="auth-card mac-window glass-morphism">
                {/* MacOS Window Controls */}
                <div className="mac-window-header">
                  <div className="mac-dot close"></div>
                  <div className="mac-dot minimize"></div>
                  <div className="mac-dot maximize"></div>
                </div>

                <div className="mac-window-content">
                  {/* Form Header (Mobile Only or Sub-header) */}
                  <div className="auth-header">
                    <h2 className="auth-title">Welcome back</h2>
                    <p className="auth-subtitle">
                      Sign in to your KCLAS account
                    </p>
                  </div>

                  {/* Login Form */}
                  <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <div className="input-wrapper glass-input">
                        <i className="ri-mail-line input-icon"></i>
                        <input
                          type="email"
                          className="form-input"
                          placeholder="Enter your email address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      {emailError && (
                        <span className="error-message">{emailError}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Password</label>
                      <div className="input-wrapper glass-input">
                        <i className="ri-lock-password-line input-icon"></i>
                        <input
                          type={showPassword ? "text" : "password"}
                          className="form-input"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          <i
                            className={
                              showPassword ? "ri-eye-line" : "ri-eye-off-line"
                            }
                          ></i>
                        </button>
                      </div>
                      {passwordError && (
                        <span className="error-message">{passwordError}</span>
                      )}
                    </div>

                    <div className="form-options">
                      <label className="checkbox-wrapper">
                        <input type="checkbox" />
                        <span className="checkmark glass-morphism"></span>
                        Remember me
                      </label>
                      <a href="#" className="forgot-link">
                        Forgot password?
                      </a>
                    </div>

                    <button
                      type="submit"
                      className={`btn-primary glass-btn ${isLoading ? "loading" : ""}`}
                      disabled={isLoading}
                    >
                      <span>{isLoading ? "" : "Sign In"}</span>
                      {isLoading && (
                        <div className="btn-loader">
                          <div className="spinner"></div>
                          <span>Signing In...</span>
                        </div>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="toast-container">
        {toastMessage && (
          <div className={`toast ${toastType} show`}>
            <i
              className={`toast-icon ${toastType === "success" ? "ri-check-line" : "ri-error-warning-line"}`}
            ></i>
            <span className="toast-message">{toastMessage}</span>
          </div>
        )}
      </div>
    </>
  );
}
