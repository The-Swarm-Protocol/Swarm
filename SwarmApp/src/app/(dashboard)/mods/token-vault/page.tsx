"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShieldAlert, Plus, Trash2, CheckCircle2, XCircle, Clock,
  ExternalLink, RefreshCw, Eye, AlertTriangle, Info, Activity,
  KeyRound, User, Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOrg } from "@/contexts/OrgContext";
import { useSession } from "@/contexts/SessionContext";
import { PROVIDER_CONFIG, type OAuthProvider } from "@/lib/token-vault";

// ═══════════════════════════════════════════════════════════════
// Types for API responses
// ═══════════════════════════════════════════════════════════════

interface Connection {
  id: string;
  provider: OAuthProvider;
  displayName: string;
  email: string;
  maskedAccessToken: string;
  grantedScopes: string[];
  expiresAt: string | null;
  connectedBy: string;
  connectedAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  active: boolean;
}

interface AccessRequest {
  id: string;
  orgId: string;
  agentId: string;
  agentName: string;
  connectionId: string;
  provider: OAuthProvider;
  requestedScopes: string[];
  reason: string;
  riskLevel: "low" | "medium" | "high";
  status: "pending" | "approved" | "denied" | "revoked" | "expired";
  reviewedBy?: string;
  reviewedAt?: string | null;
  reviewNote?: string;
  autoApproved: boolean;
  createdAt: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  provider?: OAuthProvider;
  connectionId?: string;
  agentId?: string;
  agentName?: string;
  scopes?: string[];
  actorId: string;
  actorType: "user" | "agent" | "system";
  description: string;
  timestamp: string | null;
}

type Tab = "connections" | "requests" | "audit";

// ═══════════════════════════════════════════════════════════════
// Provider Cards (used in connect dialog)
// ═══════════════════════════════════════════════════════════════

const PROVIDERS: OAuthProvider[] = ["google", "github", "slack", "microsoft", "discord"];

export default function TokenVaultPage() {
  const { org } = useOrg();
  const { wallet } = useSession();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("connections");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<OAuthProvider | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const orgId = org?.id;

  // Check for callback params
  useEffect(() => {
    const connected = searchParams.get("connected");
    const provider = searchParams.get("provider");
    const error = searchParams.get("error");

    if (connected && provider) {
      setToast({ message: `Successfully connected ${PROVIDER_CONFIG[provider as OAuthProvider]?.label || provider}!`, type: "success" });
    } else if (error) {
      setToast({ message: `Connection failed: ${error}`, type: "error" });
    }
  }, [searchParams]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchConnections = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/token-vault/connections?orgId=${orgId}`, {
        headers: { "x-wallet-address": wallet || "" },
      });
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch (err) {
      console.error("Failed to fetch connections:", err);
    }
  }, [orgId, wallet]);

  const fetchRequests = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/token-vault/request?orgId=${orgId}`, {
        headers: { "x-wallet-address": wallet || "" },
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    }
  }, [orgId, wallet]);

  const fetchAudit = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/token-vault/audit?orgId=${orgId}&limit=100`, {
        headers: { "x-wallet-address": wallet || "" },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLog(data.entries || []);
      }
    } catch (err) {
      console.error("Failed to fetch audit:", err);
    }
  }, [orgId, wallet]);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.all([fetchConnections(), fetchRequests(), fetchAudit()]).finally(() => setLoading(false));
  }, [orgId, fetchConnections, fetchRequests, fetchAudit]);

  // ═══════════════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════════════

  const handleConnect = async (provider: OAuthProvider) => {
    if (!orgId || !wallet) return;
    setActionLoading(`connect-${provider}`);
    try {
      const res = await fetch("/api/v1/token-vault/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-wallet-address": wallet },
        body: JSON.stringify({
          orgId,
          provider,
          scopes: [...selectedScopes],
        }),
      });
      const data = await res.json();
      if (res.ok && data.authorizeUrl) {
        window.location.href = data.authorizeUrl;
      } else {
        setToast({ message: data.error || "Failed to initiate connection", type: "error" });
      }
    } catch {
      setToast({ message: "Failed to initiate connection", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!orgId || !wallet) return;
    setActionLoading(`disconnect-${connectionId}`);
    try {
      const res = await fetch("/api/v1/token-vault/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-wallet-address": wallet },
        body: JSON.stringify({ connectionId, orgId }),
      });
      if (res.ok) {
        setToast({ message: "Connection removed", type: "success" });
        fetchConnections();
        fetchRequests();
      } else {
        const data = await res.json();
        setToast({ message: data.error || "Failed to disconnect", type: "error" });
      }
    } catch {
      setToast({ message: "Failed to disconnect", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReviewRequest = async (requestId: string, action: "approve" | "deny" | "revoke") => {
    if (!orgId || !wallet) return;
    setActionLoading(`review-${requestId}`);
    try {
      const res = await fetch("/api/v1/token-vault/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-wallet-address": wallet },
        body: JSON.stringify({ requestId, orgId, action }),
      });
      if (res.ok) {
        setToast({ message: `Request ${action}d`, type: "success" });
        fetchRequests();
        fetchAudit();
      } else {
        const data = await res.json();
        setToast({ message: data.error || `Failed to ${action}`, type: "error" });
      }
    } catch {
      setToast({ message: `Failed to ${action} request`, type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Render helpers
  // ═══════════════════════════════════════════════════════════════

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const riskBadge = (risk: "low" | "medium" | "high") => {
    const styles = {
      low: "bg-green-500/10 text-green-400 border-green-500/20",
      medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      high: "bg-red-500/10 text-red-400 border-red-500/20",
    };
    return (
      <span className={cn("text-xs px-2 py-0.5 rounded-full border", styles[risk])}>
        {risk.toUpperCase()}
      </span>
    );
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      approved: "bg-green-500/10 text-green-400 border-green-500/20",
      denied: "bg-red-500/10 text-red-400 border-red-500/20",
      revoked: "bg-gray-500/10 text-gray-400 border-gray-500/20",
      expired: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    };
    return (
      <span className={cn("text-xs px-2 py-0.5 rounded-full border", styles[status] || styles.pending)}>
        {status.toUpperCase()}
      </span>
    );
  };

  const providerIcon = (provider: OAuthProvider) => {
    const config = PROVIDER_CONFIG[provider];
    return (
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
        style={{ backgroundColor: config?.color || "#666" }}
      >
        {config?.icon || "?"}
      </div>
    );
  };

  const actionIcon = (action: string) => {
    switch (action) {
      case "connect": return <Plus className="h-3.5 w-3.5 text-green-400" />;
      case "disconnect": return <Trash2 className="h-3.5 w-3.5 text-red-400" />;
      case "approve":
      case "auto_approve": return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
      case "deny": return <XCircle className="h-3.5 w-3.5 text-red-400" />;
      case "revoke": return <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />;
      case "token_use": return <KeyRound className="h-3.5 w-3.5 text-blue-400" />;
      case "request": return <Clock className="h-3.5 w-3.5 text-yellow-400" />;
      default: return <Activity className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border shadow-lg text-sm",
          toast.type === "success"
            ? "bg-green-500/10 border-green-500/20 text-green-400"
            : "bg-red-500/10 border-red-500/20 text-red-400",
        )}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Auth0 Token Vault</h1>
            <p className="text-sm text-muted-foreground">
              Connect third-party services, control agent access, audit every token use
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setShowConnectDialog(true); setSelectedScopes(new Set()); setConnectingProvider(null); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Connect Service
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Connected", value: connections.length, icon: ExternalLink, color: "text-blue-400" },
          { label: "Pending Requests", value: pendingCount, icon: Clock, color: pendingCount > 0 ? "text-yellow-400" : "text-gray-500" },
          { label: "Approved Agents", value: requests.filter((r) => r.status === "approved").length, icon: CheckCircle2, color: "text-green-400" },
          { label: "Audit Events", value: auditLog.length, icon: Activity, color: "text-purple-400" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={cn("h-4 w-4", stat.color)} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit border border-border">
        {([
          { id: "connections" as Tab, label: "Connections", icon: ExternalLink },
          { id: "requests" as Tab, label: `Requests${pendingCount > 0 ? ` (${pendingCount})` : ""}`, icon: Clock },
          { id: "audit" as Tab, label: "Audit Log", icon: Activity },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              tab === t.id
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ─── Connections Tab ─── */}
          {tab === "connections" && (
            <div className="space-y-3">
              {connections.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-12 text-center">
                  <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-1">No connections yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect a third-party service through Auth0 to enable agent OAuth access.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => { setShowConnectDialog(true); setSelectedScopes(new Set()); setConnectingProvider(null); }}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Connect Service
                  </Button>
                </div>
              ) : (
                connections.map((conn) => (
                  <div key={conn.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {providerIcon(conn.provider)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{conn.displayName}</span>
                            <span className="text-xs text-muted-foreground">{PROVIDER_CONFIG[conn.provider]?.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{conn.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {conn.usageCount} uses
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => handleDisconnect(conn.id)}
                          disabled={actionLoading === `disconnect-${conn.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {conn.grantedScopes.map((scope) => (
                        <span key={scope} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {scope}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Token: <code className="bg-muted px-1 rounded">{conn.maskedAccessToken}</code></span>
                      {conn.expiresAt && (
                        <span>Expires: {new Date(conn.expiresAt).toLocaleDateString()}</span>
                      )}
                      {conn.lastUsedAt && (
                        <span>Last used: {new Date(conn.lastUsedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ─── Requests Tab ─── */}
          {tab === "requests" && (
            <div className="space-y-3">
              {requests.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-12 text-center">
                  <Bot className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-1">No access requests</h3>
                  <p className="text-sm text-muted-foreground">
                    When agents request OAuth token access, their requests will appear here for review.
                  </p>
                </div>
              ) : (
                requests.map((req) => (
                  <div key={req.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {providerIcon(req.provider)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{req.agentName}</span>
                            {riskBadge(req.riskLevel)}
                            {statusBadge(req.status)}
                            {req.autoApproved && (
                              <span className="text-xs text-muted-foreground">(auto)</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{req.reason}</p>
                        </div>
                      </div>
                      {req.status === "pending" && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            onClick={() => handleReviewRequest(req.id, "approve")}
                            disabled={actionLoading === `review-${req.id}`}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleReviewRequest(req.id, "deny")}
                            disabled={actionLoading === `review-${req.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Deny
                          </Button>
                        </div>
                      )}
                      {req.status === "approved" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                          onClick={() => handleReviewRequest(req.id, "revoke")}
                          disabled={actionLoading === `review-${req.id}`}
                        >
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Revoke
                        </Button>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {req.requestedScopes.map((scope) => {
                        const scopeConfig = PROVIDER_CONFIG[req.provider]?.availableScopes.find((s) => s.id === scope);
                        return (
                          <span key={scope} className={cn(
                            "text-xs px-2 py-0.5 rounded-full border",
                            scopeConfig?.risk === "high" ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : scopeConfig?.risk === "medium" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                            : "bg-green-500/10 text-green-400 border-green-500/20",
                          )}>
                            {scopeConfig?.label || scope}
                          </span>
                        );
                      })}
                    </div>
                    {req.reviewNote && (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        Note: {req.reviewNote}
                      </p>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {req.createdAt && <span>Requested: {new Date(req.createdAt).toLocaleString()}</span>}
                      {req.reviewedBy && req.reviewedAt && (
                        <span className="ml-3">
                          Reviewed by {req.reviewedBy.slice(0, 6)}...{req.reviewedBy.slice(-4)} on {new Date(req.reviewedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ─── Audit Tab ─── */}
          {tab === "audit" && (
            <div className="space-y-1">
              {auditLog.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-12 text-center">
                  <Eye className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-1">No audit events</h3>
                  <p className="text-sm text-muted-foreground">
                    All token vault operations will be logged here immutably.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-0 text-xs">
                    {auditLog.map((entry, i) => (
                      <div key={entry.id} className={cn(
                        "contents",
                        i % 2 === 0 ? "" : "[&>*]:bg-muted/30",
                      )}>
                        <div className="flex items-center gap-2 pl-3 py-2">
                          {actionIcon(entry.action)}
                          {entry.actorType === "agent"
                            ? <Bot className="h-3 w-3 text-blue-400" />
                            : entry.actorType === "system"
                            ? <Info className="h-3 w-3 text-gray-400" />
                            : <User className="h-3 w-3 text-green-400" />
                          }
                        </div>
                        <div className="py-2 truncate">
                          <span className="text-foreground">{entry.description}</span>
                          {entry.scopes && entry.scopes.length > 0 && (
                            <span className="text-muted-foreground ml-2">
                              [{entry.scopes.join(", ")}]
                            </span>
                          )}
                        </div>
                        <div className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                          {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── Connect Dialog ─── */}
      {showConnectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Connect a Service</h2>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setShowConnectDialog(false)}
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {!connectingProvider ? (
              /* Step 1: Choose provider */
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  Connect a third-party service through Auth0. Your agents can then request scoped access.
                </p>
                {PROVIDERS.map((provider) => {
                  const config = PROVIDER_CONFIG[provider];
                  const alreadyConnected = connections.some((c) => c.provider === provider);
                  return (
                    <button
                      key={provider}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors",
                        alreadyConnected
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-muted/50 cursor-pointer",
                      )}
                      onClick={() => {
                        if (alreadyConnected) return;
                        setConnectingProvider(provider);
                        setSelectedScopes(new Set(config.defaultScopes));
                      }}
                      disabled={alreadyConnected}
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                        style={{ backgroundColor: config.color }}
                      >
                        {config.icon}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">{config.label}</span>
                        <p className="text-xs text-muted-foreground">
                          {config.availableScopes.length} capabilities available
                        </p>
                      </div>
                      {alreadyConnected && (
                        <span className="text-xs text-green-400">Connected</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Step 2: Select scopes */
              <div className="space-y-3">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground mb-2"
                  onClick={() => setConnectingProvider(null)}
                >
                  &larr; Back to providers
                </button>

                <div className="flex items-center gap-2 mb-3">
                  {providerIcon(connectingProvider)}
                  <span className="font-medium">{PROVIDER_CONFIG[connectingProvider].label}</span>
                </div>

                <p className="text-sm text-muted-foreground">
                  Select the capabilities you want to enable. Agents will still need to request individual scope access.
                </p>

                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {PROVIDER_CONFIG[connectingProvider].availableScopes.map((scope) => (
                    <label
                      key={scope.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors",
                        selectedScopes.has(scope.id)
                          ? "border-blue-500/30 bg-blue-500/5"
                          : "border-border hover:bg-muted/30",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.has(scope.id)}
                        onChange={(e) => {
                          const next = new Set(selectedScopes);
                          if (e.target.checked) next.add(scope.id);
                          else next.delete(scope.id);
                          setSelectedScopes(next);
                        }}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{scope.label}</span>
                          {riskBadge(scope.risk)}
                        </div>
                        <p className="text-xs text-muted-foreground">{scope.description}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleConnect(connectingProvider)}
                    disabled={actionLoading === `connect-${connectingProvider}`}
                  >
                    {actionLoading === `connect-${connectingProvider}` ? (
                      <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                    )}
                    Connect with Auth0
                  </Button>
                  <Button variant="outline" onClick={() => setShowConnectDialog(false)}>
                    Cancel
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  You&apos;ll be redirected to Auth0 to authenticate. Tokens are stored encrypted (AES-256-GCM) and never exposed in the UI.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
