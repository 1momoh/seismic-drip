import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FAUCET_ABI = [
  "function claim(address to) external",
  "function faucetBalance() external view returns (uint256)",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress, action } = await req.json();

    const PRIVATE_KEY = Deno.env.get("FAUCET_PRIVATE_KEY");
    const CONTRACT_ADDRESS = Deno.env.get("FAUCET_CONTRACT_ADDRESS");
    const RPC_URL = Deno.env.get("RPC_URL") || "https://gcp-2.seismictest.net/rpc";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!CONTRACT_ADDRESS) {
      return new Response(
        JSON.stringify({ success: false, message: "Faucet contract not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { ethers } = await import("https://esm.sh/ethers@5.7.2");

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, FAUCET_ABI, provider);

    if (action === "balance") {
      const bal = await contract.faucetBalance();
      return new Response(
        JSON.stringify({ balance: ethers.utils.formatEther(bal) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "address") {
      return new Response(
        JSON.stringify({ address: CONTRACT_ADDRESS }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid wallet address" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: ipClaims } = await supabase
      .from("ip_claims")
      .select("claimed_at")
      .eq("ip_address", clientIP)
      .gte("claimed_at", twentyFourHoursAgo)
      .limit(1);

    if (ipClaims && ipClaims.length > 0) {
      return new Response(
        JSON.stringify({ success: false, cooldown: true, message: "Try again in 24h (IP cooldown)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: walletClaims } = await supabase
      .from("ip_claims")
      .select("claimed_at")
      .eq("wallet_address", walletAddress.toLowerCase())
      .gte("claimed_at", twentyFourHoursAgo)
      .limit(1);

    if (walletClaims && walletClaims.length > 0) {
      return new Response(
        JSON.stringify({ success: false, cooldown: true, message: "Try again in 24h (wallet cooldown)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ success: false, message: "Faucet private key not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contractWithSigner = contract.connect(wallet);

    let tx;
    try {
      tx = await contractWithSigner.claim(walletAddress, { gasLimit: 100000 });
    } catch (txErr: any) {
      const msg =
        txErr?.error?.message ||
        txErr?.data?.message ||
        txErr?.reason ||
        txErr?.message ||
        "Transaction failed";
      const isCooldown = /cooldown|already claimed|try again|wait/i.test(msg);
      return new Response(
        JSON.stringify({ success: false, cooldown: isCooldown, message: msg }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      return new Response(
        JSON.stringify({ success: false, message: "Transaction reverted on-chain" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("ip_claims").insert({
      ip_address: clientIP,
      wallet_address: walletAddress.toLowerCase(),
    });

    return new Response(
      JSON.stringify({ success: true, txHash: tx.hash, message: "Success!" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    const msg =
      err?.error?.message ||
      err?.data?.message ||
      err?.reason ||
      err?.message ||
      "Unexpected error";
    const isCooldown = /cooldown|already claimed|try again|wait/i.test(msg);
    return new Response(
      JSON.stringify({ success: false, cooldown: isCooldown, message: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
