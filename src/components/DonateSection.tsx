import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DonateSection = () => {
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const { data } = await supabase.functions.invoke("claim", {
          body: { action: "balance" },
        });
        if (data?.balance) setBalance(data.balance);
      } catch {}
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  const contractAddress = "Loading...";

  const handleCopy = async () => {
    if (balance === null) return;
    try {
      // We'll get the address from the balance call
      const { data } = await supabase.functions.invoke("claim", {
        body: { action: "address" },
      });
      if (data?.address) {
        await navigator.clipboard.writeText(data.address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  return (
    <motion.div
      className="w-full bg-card rounded-2xl p-6 shadow-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <h2 className="text-lg font-semibold text-foreground text-center">
        Support the Faucet
      </h2>
      <p className="text-muted-foreground text-xs text-center mt-1">
        Have extra testnet ETH? Help keep the faucet running.
      </p>

      {/* Balance */}
      <div className="mt-4 text-center">
        <span className="text-xs text-muted-foreground">Faucet Balance</span>
        <div className="text-2xl font-bold text-foreground mt-1">
          {balance !== null ? (
            <span>{balance} ETH</span>
          ) : (
            <span className="animate-pulse-soft text-muted-foreground">...</span>
          )}
        </div>
      </div>

      {/* Copy button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleCopy}
        className="w-full mt-4 py-3 rounded-xl font-semibold text-sm bg-secondary text-secondary-foreground hover:bg-muted transition-all flex items-center justify-center gap-2"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy Donate Address
          </>
        )}
      </motion.button>
    </motion.div>
  );
};

export default DonateSection;
