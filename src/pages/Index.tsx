import { useState } from "react";
import { motion } from "framer-motion";
import ClaimSection from "@/components/ClaimSection";
import DonateSection from "@/components/DonateSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md flex flex-col items-center gap-8"
      >
        {/* Header */}
        <div className="text-center">
          <motion.div
            className="text-4xl mb-3 animate-float"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
          >
            💧
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Seismic Quick Faucet
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Get 0.001 Testnet ETH every 24 hours
          </p>
        </div>

        {/* Claim Card */}
        <ClaimSection />

        {/* Donate Card */}
        <DonateSection />

        {/* Footer */}
        <Footer />
      </motion.div>
    </div>
  );
};

export default Index;
