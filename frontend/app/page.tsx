"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
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
      const response = await login(email, password);

      // With redirect: "manual", a successful 303 redirect becomes an opaqueredirect
      // response.type will be "opaqueredirect" on success
      // On failure, backend returns 200 with HTML error page
      if (response.type === "opaqueredirect" || response.status === 303) {
        showToast("Login successful! Redirecting...", "success");
        router.push("/dashboard");
      } else if (response.ok) {
        // If we get a 200 OK, it means the backend returned the error HTML template
        // (unsuccessful login returns 200 with error message in HTML)
        showToast("Invalid email or password", "error");
      } else {
        showToast("Login failed. Please try again.", "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      showToast("Network error. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Animated Blob Background */}
      <div className="blob-container">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
        <div className="blob blob-4"></div>
        <div className="blob blob-5"></div>
        <div className="blob blob-6"></div>
        <div className="blob blob-7"></div>
      </div>

      {/* Login Page */}
      <div className="page active">
        <div className="auth-container">
          <div className="auth-card glass-morphism">
            {/* Logo and Header */}
            <div className="auth-header">
              <div className="logo">
                <div className="logo-icon">K</div>
                <div className="logo-text">
                  <h1>KCLAS</h1>
                  <span>Question Paper Generator</span>
                </div>
              </div>
              <h2 className="auth-title">Welcome back to KCLAS</h2>
              <p className="auth-subtitle">
                Sign in to access the Question Paper Generator
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
                  Forgot your password?
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
