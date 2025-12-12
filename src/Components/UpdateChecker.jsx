import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { Device } from "@capacitor/device";

function compareSemver(a = "0.0.0", b = "0.0.0") {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export default function UpdateChecker({ className }) {
  const [installedVersion, setInstalledVersion] = useState(null);
  const [latestInfo, setLatestInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const info = await Device.getInfo();
        if (info && info.appVersion) {
          setInstalledVersion(info.appVersion);
          return;
        }
      } catch (e) {
      }
      const envVersion = process.env.REACT_APP_VERSION || process.env.VITE_APP_VERSION || null;
      setInstalledVersion(envVersion || "0.0.0");
    })();
  }, []);

  async function fetchLatestFromFirestore() {
    const ref = doc(db, "appConfig", "latestRelease");
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Latest release not found in Firestore");
    return snap.data();
  }

  const checkForUpdates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLatestFromFirestore();
      const latestVersion = (data.version || "").toString();
      const apkUrl = data.apkUrl || "";
      const notes = data.notes || "";
      setLatestInfo({ version: latestVersion, apkUrl, notes });

      const cmp = compareSemver(installedVersion || "0.0.0", latestVersion);
      setUpdateAvailable(cmp === -1);
      setModalOpen(true);
    } catch (err) {
      console.error("Update check error:", err);
      setError(err.message || "Failed to check updates");
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!installedVersion) return;
    (async () => {
      try {
        const data = await fetchLatestFromFirestore();
        const latestVersion = (data.version || "").toString();
        setLatestInfo({ version: latestVersion, apkUrl: data.apkUrl, notes: data.notes });
        const cmp = compareSemver(installedVersion || "0.0.0", latestVersion);
        setUpdateAvailable(cmp === -1);
      } catch (e) {
        console.warn("Silent update check failed", e);
      }
    })();
  }, [installedVersion]);

  return (
    <>
      <div className={className ? className : "update-checker"}>
        <button
          className="profile-action-button update-check-button"
          onClick={checkForUpdates}
          disabled={loading}
        >
          {loading ? "Checking…" : "Check for updates"}
          {!loading && updateAvailable && <span className="update-badge">New</span>}
        </button>
      </div>

      {modalOpen && (
        <div className="update-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="update-modal" onClick={(e) => e.stopPropagation()}>
            <h3>App Updates</h3>

            <p>
              Installed version: <strong>{installedVersion || "—"}</strong>
            </p>

            {error ? (
              <>
                <p className="error">Error: {error}</p>
                <button onClick={() => setModalOpen(false)} className="btn">Close</button>
              </>
            ) : (
              <>
                <p>
                  Latest version: <strong>{latestInfo?.version || "—"}</strong>
                </p>

                {latestInfo?.notes && <p className="notes"><em>{latestInfo.notes}</em></p>}

                {updateAvailable ? (
                  <>
                    <p>A new version is available.</p>
                    <a
                      href={latestInfo?.apkUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      onClick={() => {
                        setModalOpen(false);
                      }}
                    >
                      Download latest APK
                    </a>
                  </>
                ) : (
                  <p>You're currently on the latest release.</p>
                )}

                <div style={{ marginTop: 12 }}>
                  <button onClick={() => setModalOpen(false)} className="btn">Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

UpdateChecker.propTypes = {
  className: PropTypes.string,
};
