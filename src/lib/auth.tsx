import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile, ShopMember, Shop, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  shopMember: ShopMember | null;
  shop: Shop | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshShop: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shopMember, setShopMember] = useState<ShopMember | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
  }, []);

  const loadShopData = useCallback(async (userId: string) => {
    const { data: memberData } = await supabase
      .from('shop_members')
      .select('*, shop:shops(*)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (memberData) {
      setShopMember(memberData);
      setShop(memberData.shop as unknown as Shop);
      setRole(memberData.role as UserRole);
    } else {
      // Check if user is a shop owner without a member record
      const { data: shopData } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', userId)
        .limit(1)
        .maybeSingle();

      if (shopData) {
        setShop(shopData);
        setRole('OWNER');
        // Create shop member record
        await supabase.from('shop_members').insert({
          shop_id: shopData.id,
          user_id: userId,
          role: 'OWNER',
          is_active: true,
        });
        setShopMember({
          id: '',
          shop_id: shopData.id,
          user_id: userId,
          role: 'OWNER',
          is_active: true,
          created_at: new Date().toISOString(),
        });
      }
    }
  }, []);

  const refreshShop = useCallback(async () => {
    if (user) {
      await loadShopData(user.id);
    }
  }, [user, loadShopData]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        Promise.all([loadProfile(s.user.id), loadShopData(s.user.id)]).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        Promise.all([loadProfile(s.user.id), loadShopData(s.user.id)]);
      } else {
        setProfile(null);
        setShopMember(null);
        setShop(null);
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile, loadShopData]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setShopMember(null);
    setShop(null);
    setRole(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        shopMember,
        shop,
        role,
        loading,
        signIn,
        signUp,
        signOut,
        refreshShop,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
