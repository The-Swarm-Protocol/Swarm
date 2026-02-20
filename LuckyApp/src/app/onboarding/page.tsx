'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTeam } from '@/contexts/TeamContext';

export default function OnboardingPage() {
  const router = useRouter();
  const { createTeam } = useTeam();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);

    try {
      createTeam(name.trim(), description.trim() || undefined);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create team';
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <Card className="w-full max-w-lg border-green-500/30">
        <CardHeader className="text-center">
          <div className="text-5xl mb-4">🍀</div>
          <CardTitle className="text-2xl">Create Your Team</CardTitle>
          <CardDescription>
            Set up your team to start coordinating agents and missions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Team Name *</label>
            <input
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g. Lucky Squad"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Description (optional)</label>
            <textarea
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[80px]"
              placeholder="What does your team do?"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="w-full bg-green-500 hover:bg-green-600 text-white"
          >
            {creating ? 'Creating...' : 'Create Team'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
