
-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('citizen', 'lawyer', 'admin');

-- Create enum for lawyer status
CREATE TYPE public.lawyer_status AS ENUM ('pending', 'approved', 'rejected');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'citizen',
  specialization TEXT,
  status lawyer_status DEFAULT 'pending',
  document_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Policies
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Users can view own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Insert some seed data (without user_id since these are managed accounts)
INSERT INTO public.profiles (name, email, phone, role, specialization, status, document_url) VALUES
  ('Ahmed Hassan', 'ahmed@example.com', '+1234567890', 'lawyer', 'Constitutional Law', 'pending', 'https://example.com/doc1.pdf'),
  ('Sara Ali', 'sara@example.com', '+1234567891', 'lawyer', 'Labor Law', 'pending', 'https://example.com/doc2.pdf'),
  ('Omar Khaled', 'omar@example.com', '+1234567892', 'lawyer', 'Criminal Law', 'approved', 'https://example.com/doc3.pdf'),
  ('Layla Mahmoud', 'layla@example.com', '+1234567893', 'lawyer', 'Family Law', 'rejected', 'https://example.com/doc4.pdf'),
  ('Youssef Ibrahim', 'youssef@example.com', '+1234567894', 'citizen', NULL, NULL, NULL),
  ('Nour Farid', 'nour@example.com', '+1234567895', 'citizen', NULL, NULL, NULL),
  ('Mona Saeed', 'mona@example.com', '+1234567896', 'lawyer', 'Corporate Law', 'pending', 'https://example.com/doc5.pdf'),
  ('Karim Nasser', 'karim@example.com', '+1234567897', 'lawyer', 'International Law', 'approved', 'https://example.com/doc6.pdf');
