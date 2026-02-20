import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SwarmsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Swarms</h1>
        <p className="text-gray-500 mt-1">Manage your prediction market swarms</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {["Polymarket Alpha", "Kalshi Scout", "Manifold Hunter"].map((name) => (
          <Card key={name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{name}</CardTitle>
                <Badge>Active</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Swarm details coming soon...</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
