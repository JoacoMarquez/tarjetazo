"use client";

import { useEffect } from "react";
import { iniciarAnalitica } from "@/lib/analitica";

export function Analitica() {
  useEffect(iniciarAnalitica, []);
  return null;
}
