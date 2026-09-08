import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Store, ArrowRight, Mail, Lock, User } from 'lucide-react';
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
        // Wait for the user to be created, then create shop
        const { data: { session: newSession } } = await supabase.auth.getSession();
        if (newSession?.user && shopName) {
          await createShop(shopName, newSession.user.id);
        }
        navigate('/', { replace: true });
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <Store className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Zyven</h1>
            <p className="text-xs text-text-muted">Run your shop. Know your numbers.</p>
          </div>
        </div>

        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-center">
              {mode === 'signin' ? 'Welcome Back' : 'Start Your Shop'}
            </CardTitle>
            <CardDescription className="text-center">
              {mode === 'signin'
                ? 'Sign in to manage your duka'
                : 'Create your account and shop'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                      <Input
                        id="fullName"
                        placeholder="John Kamau"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shopName">Shop Name</Label>
                    <div className="relative">
                      <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                      <Input
                        id="shopName"
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

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-danger text-center">{error}</p>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
                className="text-sm text-text-secondary hover:text-primary transition-colors"
              >
                {mode === 'signin'
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Sign in'}
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-text-muted mt-6">
          Zyven — POS & Inventory for Kenyan Shops
        </p>
      </motion.div>
    </div>
  );
}
