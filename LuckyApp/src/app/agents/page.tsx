import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent Fleet</h1>
        <p className="text-gray-500 mt-1">Monitor and manage your AI agents</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          { name: "Scout-001", status: "Running", role: "Market Scanner" },
          { name: "Trader-007", status: "Running", role: "Position Manager" },
          { name: "Analyst-003", status: "Idle", role: "Data Analyst" },
        ].map((agent) => (
          <Card key={agent.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{agent.name}</CardTitle>
                <Badge variant={agent.status === "Running" ? "default" : "secondary"}>
                  {agent.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">{agent.role}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
