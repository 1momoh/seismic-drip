import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Minimal ABI for faucet contract
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

    // Dynamic import ethers
    const { ethers } = await import("https://esm.sh/ethers@5.7.2");

    if (!CONTRACT_ADDRESS) {
      return new Response(
        JSON.stringify({ success: false, message: "Faucet contract not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, FAUCET_ABI, provider);

    // Handle balance query
    if (action === "balance") {
      const bal = await contract.faucetBalance();
      return new Response(
        JSON.stringify({ balance: ethers.utils.formatEther(bal) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle address query
    if (action === "address") {
      return new Response(
        JSON.stringify({ address: CONTRACT_ADDRESS }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate wallet address
    if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid wallet address" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check IP cooldown
    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Check IP cooldown
    const { data: ipClaims } = await supabase
      .from("ip_claims")
      .select("claimed_at")
      .eq("ip_address", clientIP)
      .gte("claimed_at", twentyFourHoursAgo)
      .limit(1);

    if (ipClaims && ipClaims.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          cooldown: true,
          message: "Try again in 24h (IP cooldown)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check wallet cooldown
    const { data: walletClaims } = await supabase
      .from("ip_claims")
      .select("claimed_at")
      .eq("wallet_address", walletAddress.toLowerCase())
      .gte("claimed_at", twentyFourHoursAgo)
      .limit(1);

    if (walletClaims && walletClaims.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          cooldown: true,
          message: "Try again in 24h (wallet cooldown)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send claim transaction
    if (!PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ success: false, message: "Faucet not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contractWithSigner = contract.connect(wallet);

    // Dry-run first so contract reverts return useful messages without sending a tx
    try {
      await contractWithSigner.callStatic.claim(walletAddress);
    } catch (simErr: any) {
      const rawSimMsg =
        simErr?.error?.message ||
        simErr?.data?.message ||
        simErr?.reason ||
        simErr?.message ||
        "Claim rejected by faucet contract";

      const isGenericRevert = /execution reverted|transaction failed/i.test(rawSimMsg);
      const simMsg = isGenericRevert
        ? "Claim rejected by faucet contract (likely cooldown or ineligible wallet)"
        : rawSimMsg;

      const isCooldown = /cooldown|already claimed|try again|wait|execution reverted|transaction failed/i.test(rawSimMsg);

      return new Response(
        JSON.stringify({
          success: false,
          cooldown: isCooldown,
          message: simMsg,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tx = await contractWithSigner.claim(walletAddress, { gasLimit: 100000 });
    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      return new Response(
        JSON.stringify({ success: false, message: "Claim transaction reverted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record claim
    await supabase.from("ip_claims").insert({
      ip_address: clientIP,
      wallet_address: walletAddress.toLowerCase(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        txHash: tx.hash,
        message: "Success!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Claim error:", err);

    const rawMessage =
      err?.error?.message || err?.data?.message || err?.reason || err?.message || "Transaction failed";

    const isExpectedContractFailure =
      ["CALL_EXCEPTION", "UNPREDICTABLE_GAS_LIMIT", "INSUFFICIENT_FUNDS"].includes(err?.code) ||
      /revert|execution reverted|transaction failed|already claimed|cooldown|insufficient/i.test(rawMessage);

    const isCooldown = /cooldown|already claimed|try again|wait|execution reverted|transaction failed/i.test(rawMessage);
    const message = /execution reverted|transaction failed/i.test(rawMessage)
      ? "Claim rejected by faucet contract (likely cooldown or ineligible wallet)"
      : rawMessage;

    return new Response(
      JSON.stringify({
        success: false,
        cooldown: isCooldown,
        message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: isExpectedContractFailure ? 200 : 500,
      }
    );
  }
});
