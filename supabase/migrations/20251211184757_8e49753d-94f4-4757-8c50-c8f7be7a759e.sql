-- Add coupon tracking columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_coupon_code text,
ADD COLUMN IF NOT EXISTS last_affiliate_id uuid,
ADD COLUMN IF NOT EXISTS last_affiliate_coupon_id uuid;