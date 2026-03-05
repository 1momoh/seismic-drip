import { motion } from "framer-motion";

const Footer = () => {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.7 }}
      className="text-center text-xs text-muted-foreground space-y-1 pt-4"
    >
      <p>made by .87🌵</p>
      <p>
        Follow{" "}
        <a
          href="https://x.com/ofalamin"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-medium"
        >
          @ofalamin
        </a>{" "}
        on 𝕏
      </p>
    </motion.footer>
  );
};

export default Footer;
