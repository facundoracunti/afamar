import type { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export function Container({ children, className = "" }: ContainerProps) {
  return <div style={{ width: "100%", maxWidth: 1200, margin: "0 auto", padding: "0 2rem" }} className={className}>{children}</div>;
}
