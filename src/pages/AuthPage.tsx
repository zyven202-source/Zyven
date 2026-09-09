import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Store, ArrowRight, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { createShop } from '@/lib/database';
import { supabase } from '@/lib/supabase';

export default function AuthPage() {
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [shopName, setShopName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  React.useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
          setLoading(false);
          return;
        }
        navigate('/', { replace: true });
      } else {
        const result = await signUp(email, password, fullName);
        if (result.error) {
          setError(result.error);
          setLoading(false);
          return;
        }
        const { data: { session: newSession } } = await supabase.auth.getSession();
        if (newSession?.user && shopName) {
          await createShop(shopName, newSession.user.id);
        }
        navigate('/', { replace: true });
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-5 py-12">
      {/* Brand */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center">
          <span className="text-text-inverse font-bold text-lg">Z</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-text tracking-tight">Zyven</h1>
          <p className="text-xs text-text-muted leading-tight">Run your shop. Know your numbers.</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm">
        <div className="bg-surface border border-border-subtle rounded-2xl p-6">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-text">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm text-text-muted mt-1">
              {mode === 'signin'
                ? 'Sign in to your shop'
                : 'Set up your shop in minutes'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-text-secondary">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
                    <Input
                      placeholder="John Kamau"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-text-secondary">Shop Name</Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
                    <Input
                      placeholder="Kamau Mini Mart"
                      value={shopName}
                      onChange={e => setShopName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2.5 rounded-lg bg-danger-muted border border-danger/20">
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  Please wait...
                </span>
              ) : (
                <>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Toggle */}
          <div className="mt-5 text-center">
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
              className="text-sm text-text-muted hover:text-primary transition-colors"
            >
              {mode === 'signin'
                ? <>New here? <span className="text-primary font-medium">Create an account</span></>
                : <>Already have an account? <span className="text-primary font-medium">Sign in</span></>}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-text-muted mt-6 leading-relaxed">
          POS & Inventory for Kenyan Shops
        </p>
      </div>
    </div>
  );
}
