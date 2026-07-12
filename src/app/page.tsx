'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase, TrainingRecord } from '@/utils/supabase';

export default function Home() {
  const [tab, setTab] = useState<'checkin' | 'dashboard'>('checkin');
  
  // Check-in stavy
  const [feeling, setFeeling] = useState('Neutrální');
  const [rhr, setRhr] = useState('50');
  const [bodyBattery, setBodyBattery] = useState('80');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);

  // Dashboard stavy
  const [history, setHistory] = useState<TrainingRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (tab === 'dashboard') {
      loadHistory();
    }
  }, [tab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('training_history')
      .select('*')
      .order('date', { ascending: false })
      .limit(10);
    
    if (data) setHistory(data);
    setLoadingHistory(false);
  };

  const getStatusClass = (planText: string) => {
    if (!planText) return '';
    if (planText.includes('Zelený')) return 'status-green';
    if (planText.includes('Žlutý')) return 'status-yellow';
    if (planText.includes('Červený') || planText.includes('Stopka')) return 'status-red';
    return '';
  };

  const handleGenerate = async () => {
    setLoading(true);
    setPlan(null);
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          feeling,
          rhr: parseInt(rhr) || 50,
          bodyBattery: parseInt(bodyBattery) || 80
        })
      });
      const data = await res.json();
      if (data.plan) {
        setPlan(data.plan);
      } else {
        alert(data.error || 'Chyba při generování plánu.');
      }
    } catch (err: any) {
      alert(err.message || 'Došlo k chybě připojení.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="header">
        <h1>AI Coach</h1>
        <p>Optimalizace zátěže & ochrana imunity</p>
      </header>

      <div className="tabs">
        <button 
          className={`tab-btn ${tab === 'checkin' ? 'active' : ''}`} 
          onClick={() => setTab('checkin')}
        >
          Dnešní plán
        </button>
        <button 
          className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} 
          onClick={() => setTab('dashboard')}
        >
          Historie
        </button>
      </div>

      {tab === 'checkin' && (
        <>
          {!plan && !loading && (
            <div className="glass-card animate-fade-in">
              <div className="form-group">
                <label htmlFor="feeling">Jak se dnes ráno cítíš?</label>
                <select
                  id="feeling"
                  value={feeling}
                  onChange={(e) => setFeeling(e.target.value)}
                >
                  <option value="Skvěle">Skvěle (100% regenerace)</option>
                  <option value="Neutrální">Neutrální (Běžná únava)</option>
                  <option value="Cítím zánět">Cítím zánět / Náběh na nemoc</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="rhr">Klidová tepovka (RHR)</label>
                  <input
                    type="number"
                    id="rhr"
                    value={rhr}
                    onChange={(e) => setRhr(e.target.value)}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'white', fontSize: '1rem', outline: 'none' }}
                  />
                </div>
                
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="bodyBattery">Body Battery</label>
                  <input
                    type="number"
                    id="bodyBattery"
                    value={bodyBattery}
                    onChange={(e) => setBodyBattery(e.target.value)}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'white', fontSize: '1rem', outline: 'none' }}
                  />
                </div>
              </div>

              <button 
                className="btn" 
                onClick={handleGenerate}
                disabled={loading}
              >
                Vygenerovat denní plán
              </button>
            </div>
          )}

          {loading && (
            <div className="loader animate-fade-in">
              <div className="spinner"></div>
              <div>Analyzuji fyziologii a historii...</div>
            </div>
          )}

          {plan && !loading && (
            <div className={`glass-card plan-content animate-fade-in ${getStatusClass(plan)}`}>
              <ReactMarkdown>{plan}</ReactMarkdown>
              
              <button 
                className="btn" 
                style={{ marginTop: '2rem', background: 'rgba(255,255,255,0.1)', boxShadow: 'none' }}
                onClick={() => {
                  setPlan(null);
                  setTab('dashboard'); // Pošleme ho rovnou do historie po zavření
                }}
              >
                Zavřít a podívat se do historie
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'dashboard' && (
        <div className="animate-fade-in">
          {loadingHistory ? (
            <div className="loader">
              <div className="spinner"></div>
              <div>Načítám tvou historii...</div>
            </div>
          ) : history.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', opacity: 0.7 }}>
              <p>Zatím tu nemáš žádné záznamy.</p>
              <p>Vygeneruj si svůj první dnešní plán!</p>
            </div>
          ) : (
            history.map((record, index) => (
              <div key={record.id || index} className={`glass-card plan-content ${getStatusClass(record.ai_recommendation)}`} style={{ marginBottom: '1rem', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '1.1rem' }}>{new Date(record.date).toLocaleDateString('cs-CZ')}</strong>
                  <span style={{ color: 'var(--text-secondary)' }}>{record.feeling}</span>
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  {record.activity}
                </div>
                <div style={{ maxHeight: '150px', overflow: 'hidden', position: 'relative' }}>
                  <ReactMarkdown>{record.ai_recommendation}</ReactMarkdown>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50px', background: 'linear-gradient(transparent, var(--surface-color))' }}></div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
