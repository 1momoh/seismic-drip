import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ExternalLink, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ClaimStatus = "idle" | "loading" | "success" | "cooldown" | "error";

const generateCaptcha = () => {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  return { a, b, answer: a + b };
};

const ClaimSection = () => {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<ClaimStatus>("idle");
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState("");
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState("");

  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha());
    setCaptchaInput("");
  }, []);

  const isCaptchaValid = parseInt(captchaInput) === captcha.answer;

  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(address);

  const handleClaim = async () => {
    if (!isValidAddress || !isCaptchaValid) return;
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
        refreshCaptcha();
      } else if (data.cooldown) {
        setStatus("cooldown");
        setMessage(data.message || "Try again in 24h");
        refreshCaptcha();
      } else {
        setStatus("error");
        setMessage(data.message || "Something went wrong");
        refreshCaptcha();
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Failed to claim");
      refreshCaptcha();
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

      {/* Math Captcha */}
      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {captcha.a} + {captcha.b} =
        </span>
        <input
          type="number"
          placeholder="?"
          value={captchaInput}
          onChange={(e) => setCaptchaInput(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary/40 transition-all"
        />
        <button
          type="button"
          onClick={refreshCaptcha}
          className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="New captcha"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        disabled={!isValidAddress || !isCaptchaValid || status === "loading"}
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
          className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          View on Explorer <ExternalLink className="w-3.5 h-3.5" />
        </motion.a>
      )}
    </motion.div>
  );
};

export default ClaimSection;
