
-- Allow all authenticated users to read profiles (for dashboard)
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to update profiles (for admin actions)
CREATE POLICY "Authenticated users can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (true);

-- Allow all authenticated users to delete profiles
CREATE POLICY "Authenticated users can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (true);

-- Allow all authenticated users to insert profiles
CREATE POLICY "Authenticated users can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);
