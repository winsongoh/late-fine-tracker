import React from "react";
import AuthWrapper from "./AuthWrapper.jsx";
import LateFineTrackerSupabase from "./LateFineTrackerSupabase.jsx";

export default function App() {
  return (
    <AuthWrapper>
      <LateFineTrackerSupabase />
    </AuthWrapper>
  );
}