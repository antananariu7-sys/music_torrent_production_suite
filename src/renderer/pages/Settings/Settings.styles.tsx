export const settingsStyles = `
  @keyframes fade-in-down {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slide-in-up {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes pulse-glow {
    0%, 100% {
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
    }
    50% {
      box-shadow: 0 0 30px rgba(59, 130, 246, 0.6);
    }
  }

  .settings-header {
    animation: fade-in-down 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  .settings-card {
    animation: slide-in-up 0.6s cubic-bezier(0.4, 0, 0.2, 1) backwards;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .settings-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  }

  .settings-card-1 {
    animation-delay: 0.1s;
  }

  .settings-card-2 {
    animation-delay: 0.2s;
  }

  .settings-card-3 {
    animation-delay: 0.3s;
  }

  .back-button {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .back-button:hover {
    transform: translateX(-4px);
  }

  .theme-indicator {
    transition: all 0.3s ease;
  }

  .theme-indicator.active {
    animation: pulse-glow 2s ease-in-out infinite;
  }
`
