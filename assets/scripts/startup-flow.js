export function createStartupFlow({
  preUefiScreen,
  preUefiMainView,
  devicePageView,
  syncPreUefiSelection
}) {
  function showPreUefiScreen() {
    const waitAppearDelay = 300;
    const waitHoldDelay = 600;
    const authFadeDuration = 300;
    const blackHoldDelay = 300;
    const preUefiFadeDuration = 300;
    const menuDelay = 1000;

    preUefiMainView?.classList.remove("is-active", "is-fading-in", "is-fading-out", "is-prep");
    devicePageView?.classList.remove("is-active", "is-fading-in", "is-fading-out", "is-prep");
    document.body.classList.remove(
      "auth-gate-show-wait",
      "auth-gate-fading-out",
      "auth-gate-blackhold",
      "pre-uefi-active",
      "pre-uefi-fading-in"
    );

    window.setTimeout(() => {
      document.body.classList.add("auth-gate-show-wait");

      window.setTimeout(() => {
        document.body.classList.add("auth-gate-fading-out");

        window.setTimeout(() => {
          document.body.classList.remove("auth-gate-show-wait");
          document.body.classList.remove("auth-gate");
          document.body.classList.remove("auth-gate-fading-out");
          document.body.classList.add("auth-gate-blackhold");

          window.setTimeout(() => {
            document.body.classList.remove("auth-gate-blackhold");
            document.body.classList.add("pre-uefi-active");

            window.requestAnimationFrame(() => {
              void preUefiScreen?.offsetWidth;
              document.body.classList.add("pre-uefi-fading-in");

              window.setTimeout(() => {
                window.setTimeout(() => {
                  preUefiMainView?.classList.add("is-prep");
                  syncPreUefiSelection(0);

                  window.requestAnimationFrame(() => {
                    void preUefiMainView?.offsetWidth;
                    preUefiMainView?.classList.remove("is-prep");
                    preUefiMainView?.classList.add("is-fading-in");

                    window.setTimeout(() => {
                      preUefiMainView?.classList.remove("is-fading-in");
                      preUefiMainView?.classList.add("is-active");
                    }, preUefiFadeDuration);
                  });
                }, menuDelay);
              }, preUefiFadeDuration);
            });
          }, blackHoldDelay);
        }, authFadeDuration);
      }, waitHoldDelay);
    }, waitAppearDelay);
  }

  function hidePreUefiScreen() {
    document.body.classList.remove("pre-uefi-active");
    document.body.classList.remove("pre-uefi-fading-in");
    document.body.classList.remove("auth-gate-show-wait", "auth-gate-fading-out", "auth-gate-blackhold");
  }

  function startAuthGate() {
    document.body.classList.add("auth-gate");
    document.body.classList.remove(
      "auth-gate-reveal",
      "auth-gate-reveal-fast",
      "auth-gate-show-wait",
      "auth-gate-fading-out",
      "auth-gate-blackhold",
      "pre-uefi-active",
      "pre-uefi-fading-in"
    );
  }

  function finishAuthGateReveal() {
    showPreUefiScreen();
  }

  function finishAuthGateRevealFast() {
    document.body.classList.remove("auth-gate");
    hidePreUefiScreen();
    document.body.classList.add("auth-gate-reveal-fast");
    window.setTimeout(() => {
      document.body.classList.remove("auth-gate-reveal-fast");
    }, 90);
  }

  return {
    showPreUefiScreen,
    hidePreUefiScreen,
    startAuthGate,
    finishAuthGateReveal,
    finishAuthGateRevealFast
  };
}
