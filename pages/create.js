import { useState } from "react";
import Head from "next/head";
import Link from "next/link";

export default function CreateRoom() {
  const [step, setStep] = useState(1);
  const [roomName, setRoomName] = useState("");
  const [password, setPassword] = useState("");
  const [hostName, setHostName] = useState("");
  const [copied, setCopied] = useState(false);

  const buildCommand = () => {
    const name = roomName.trim() || "My Room";
    const pw = password.trim();
    const host = hostName.trim() || "Anonymous";
    let cmd = `npx sshchat create --name "${name}" --host "${host}"`;
    if (pw) cmd += ` --password "${pw}"`;
    return cmd;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildCommand());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = buildCommand();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const canProceed = roomName.trim().length > 0;

  return (
    <>
      <Head>
        <title>Create Room - SSH Chat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header>
        <div className="container">
          <Link href="/" className="logo">
            <span className="prompt">&gt;</span> ssh-chat
          </Link>
          <nav>
            <Link href="/" className="btn btn-secondary btn-sm">
              Back to Rooms
            </Link>
          </nav>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <div className="create-page">
          <h1>Create a Chat Room</h1>
          <p>
            Host a real-time chat room from your laptop. Others join from their
            browser.
          </p>

          {step === 1 && (
            <>
              <div className="info-banner">
                <span className="icon">&#9432;</span>
                <span>
                  Your laptop will act as the chat server. It must stay online
                  for the room to remain active.
                </span>
              </div>

              <div className="form-group">
                <label>Room Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Study Group, Project Chat"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Your Display Name</label>
                <input
                  type="text"
                  placeholder="e.g., Alice (default: Anonymous)"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Room Password (optional)</label>
                <input
                  type="text"
                  placeholder="Leave empty for no password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="form-actions">
                <Link href="/" className="btn btn-secondary">
                  Cancel
                </Link>
                <button
                  className="btn btn-primary"
                  disabled={!canProceed}
                  onClick={() => setStep(2)}
                  style={{ opacity: canProceed ? 1 : 0.5 }}
                >
                  Generate Command
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h3>Open a terminal on your laptop</h3>
                  <p>
                    Open Command Prompt, Terminal, or PowerShell.
                  </p>
                </div>
              </div>

              <div className="step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h3>Run this command</h3>
                  <p>
                    Copy and paste the command below. It starts the chat server
                    on your machine.
                  </p>
                  <div className="command-box">
                    <code>{buildCommand()}</code>
                    <button className="copy-btn" onClick={handleCopy}>
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h3>Wait for &quot;Room is live!&quot;</h3>
                  <p>
                    The command sets up SSH server, tunnel, and bridge. When you
                    see &quot;Room is live!&quot;, your room is ready.
                  </p>
                </div>
              </div>

              <div className="step">
                <div className="step-number">4</div>
                <div className="step-content">
                  <h3>Share the room password</h3>
                  <p>
                    Tell your friends the password {password ? `("${password}")` : "(you didn't set one)"} so they can join from
                    the website.
                  </p>
                </div>
              </div>

              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => setStep(1)}>
                  Back
                </button>
                <Link href="/" className="btn btn-primary">
                  I&apos;ll join from the website
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          SSH Chat Web &mdash; Computer Networks Mini Project
        </div>
      </footer>
    </>
  );
}
