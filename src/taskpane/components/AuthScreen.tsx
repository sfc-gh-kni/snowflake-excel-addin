import React, { useState } from "react";

interface Props {
  onStartOAuth: (account: string) => void;
  error?: string;
}

export default function AuthScreen({ onStartOAuth, error }: Props) {
  const [account, setAccount] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (account.trim()) onStartOAuth(account.trim());
  };

  return (
    <div className="auth-screen">
      <div className="auth-header">
        <img src="/assets/snowflake-logo.svg" alt="Snowflake" className="auth-logo" />
        <h1>Sign in to Snowflake</h1>
        <p>Enter your account identifier to continue.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label>Account Identifier</label>
          <input
            type="text"
            placeholder="e.g. myorg-myaccount"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            autoFocus
            required
          />
          <span className="hint">Found in Snowsight under Admin › Account</span>
        </div>

        {error && <div className="error-box">{error}</div>}

        <button type="submit" className="btn-snowflake">
          <img src="/assets/snowflake-mark.svg" alt="" className="btn-icon" />
          Sign in with Snowflake
        </button>
      </form>

      <p className="auth-footer">
        You'll be redirected to the Snowflake login page.
      </p>
    </div>
  );
}
