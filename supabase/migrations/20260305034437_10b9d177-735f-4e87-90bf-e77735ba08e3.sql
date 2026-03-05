
CREATE TABLE public.ip_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_ip_claims_ip_address ON public.ip_claims (ip_address, claimed_at DESC);
CREATE INDEX idx_ip_claims_wallet ON public.ip_claims (wallet_address, claimed_at DESC);

ALTER TABLE public.ip_claims ENABLE ROW LEVEL SECURITY;
