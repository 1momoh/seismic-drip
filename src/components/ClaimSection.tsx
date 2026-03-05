import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ClaimStatus = "idle" | "loading" | "success" | "cooldown" | "error";

const ClaimSection = () => {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<ClaimStatus>("idle");
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState("");

  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(address);

  const handleClaim = async () => {
    if (!isValidAddress) return;
    setStatus("loading");
    setMessage("Sending drip...");
    setTxHash("");

    try {
      const { data, error } = await supabase.functions.invoke("claim", {
        body: { walletAddress: address },
      });

      if (error) throw error;

      if (data.success) {
        setStatus("success");
        setMessage("Success! 🎉");
        setTxHash(data.txHash || "");
      } else if (data.cooldown) {
        setStatus("cooldown");
        setMessage(data.message || "Try again in 24h");
      } else {
        setStatus("error");
        setMessage(data.message || "Something went wrong");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Failed to claim");
    }
  };

  return (
    <motion.div
      className="w-full bg-card rounded-2xl p-6 shadow-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <input
        type="text"
        placeholder="Enter your wallet address"
        value={address}
        onChange={(e) => {
          setAddress(e.target.value);
          if (status !== "idle") setStatus("idle");
        }}
        className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary/40 transition-all"
      />

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        disabled={!isValidAddress || status === "loading"}
        onClick={handleClaim}
        className="w-full mt-4 py-3 rounded-xl font-semibold text-sm text-primary-foreground shadow-button disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        style={{ background: "var(--gradient-button)" }}
      >
        {status === "loading" ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending drip...
          </span>
        ) : (
          "Claim 0.001 ETH"
        )}
      </motion.button>

      {/* Status message */}
      <AnimatePresence mode="wait">
        {status !== "idle" && status !== "loading" && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-4 flex items-center gap-2 text-sm justify-center ${
              status === "success"
                ? "text-green-600"
                : status === "cooldown"
                ? "text-amber-600"
                : "text-destructive"
            }`}
          >
            {status === "success" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* TX link */}
      {txHash && (
        <motion.a
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          href={`https://seismic-testnet.socialscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center justify-center gap-1 text-xs text-primary hover:underline"
        >
          View on Explorer <ExternalLink className="w-3 h-3" />
        </motion.a>
      )}
    </motion.div>
  );
};

export default ClaimSection;
