'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        // Úspěch - prohlížeč si uloží HTTP-only cookie
        router.push('/');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Nesprávné heslo.');
      }
    } catch (err) {
      setError('Došlo k chybě připojení.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem' }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '0.5rem', color: 'white' }}>🔒 Zabezpečeno</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Zadejte hlavní heslo pro přístup do AI Coache.</p>
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <input
              type="password"
              placeholder="Master Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              style={{ textAlign: 'center', letterSpacing: '2px', fontSize: '1.2rem' }}
            />
          </div>
          
          {error && <p style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>{error}</p>}
          
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Ověřuji...' : 'Vstoupit'}
          </button>
        </form>
      </div>
    </div>
  );
}
