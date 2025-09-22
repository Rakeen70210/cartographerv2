/**
 * EasingFunctions - Collection of easing functions for smooth animations
 * Provides various easing curves for natural cloud animations
 */

export type EasingFunction = (t: number) => number;

/**
 * Collection of standard easing functions
 */
export class EasingFunctions {
  /**
   * Linear interpolation (no easing)
   */
  static linear: EasingFunction = (t: number): number => {
    return t;
  };

  /**
   * Quadratic easing functions
   */
  static quad = {
    in: (t: number): number => t * t,
    out: (t: number): number => t * (2 - t),
    inOut: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
  };

  /**
   * Cubic easing functions
   */
  static cubic = {
    in: (t: number): number => t * t * t,
    out: (t: number): number => (--t) * t * t + 1,
    inOut: (t: number): number => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
  };

  /**
   * Quartic easing functions
   */
  static quart = {
    in: (t: number): number => t * t * t * t,
    out: (t: number): number => 1 - (--t) * t * t * t,
    inOut: (t: number): number => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t
  };

  /**
   * Quintic easing functions
   */
  static quint = {
    in: (t: number): number => t * t * t * t * t,
    out: (t: number): number => 1 + (--t) * t * t * t * t,
    inOut: (t: number): number => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t
  };

  /**
   * Sine easing functions
   */
  static sine = {
    in: (t: number): number => 1 - Math.cos(t * Math.PI / 2),
    out: (t: number): number => Math.sin(t * Math.PI / 2),
    inOut: (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2
  };

  /**
   * Exponential easing functions
   */
  static expo = {
    in: (t: number): number => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
    out: (t: number): number => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    inOut: (t: number): number => {
      if (t === 0) return 0;
      if (t === 1) return 1;
      if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
      return (2 - Math.pow(2, -20 * t + 10)) / 2;
    }
  };

  /**
   * Circular easing functions
   */
  static circ = {
    in: (t: number): number => 1 - Math.sqrt(1 - t * t),
    out: (t: number): number => Math.sqrt(1 - (--t) * t),
    inOut: (t: number): number => {
      if (t < 0.5) return (1 - Math.sqrt(1 - 4 * t * t)) / 2;
      return (Math.sqrt(1 - (-2 * t + 2) * (-2 * t + 2)) + 1) / 2;
    }
  };

  /**
   * Back easing functions (overshoot)
   */
  static back = {
    in: (t: number): number => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return c3 * t * t * t - c1 * t * t;
    },
    out: (t: number): number => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    inOut: (t: number): number => {
      const c1 = 1.70158;
      const c2 = c1 * 1.525;
      if (t < 0.5) {
        return (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2;
      }
      return (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }
  };

  /**
   * Elastic easing functions
   */
  static elastic = {
    in: (t: number): number => {
      const c4 = (2 * Math.PI) / 3;
      if (t === 0) return 0;
      if (t === 1) return 1;
      return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
    },
    out: (t: number): number => {
      const c4 = (2 * Math.PI) / 3;
      if (t === 0) return 0;
      if (t === 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    inOut: (t: number): number => {
      const c5 = (2 * Math.PI) / 4.5;
      if (t === 0) return 0;
      if (t === 1) return 1;
      if (t < 0.5) {
        return -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2;
      }
      return (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
    }
  };

  /**
   * Bounce easing functions
   */
  static bounce = {
    in: (t: number): number => 1 - EasingFunctions.bounce.out(1 - t),
    out: (t: number): number => {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (t < 1 / d1) {
        return n1 * t * t;
      } else if (t < 2 / d1) {
        return n1 * (t -= 1.5 / d1) * t + 0.75;
      } else if (t < 2.5 / d1) {
        return n1 * (t -= 2.25 / d1) * t + 0.9375;
      } else {
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
      }
    },
    inOut: (t: number): number => {
      if (t < 0.5) {
        return (1 - EasingFunctions.bounce.out(1 - 2 * t)) / 2;
      }
      return (1 + EasingFunctions.bounce.out(2 * t - 1)) / 2;
    }
  };

  /**
   * Cloud-specific easing functions optimized for natural movement
   */
  static cloud = {
    /**
     * Gentle drift - smooth, continuous movement
     */
    drift: (t: number): number => {
      return EasingFunctions.sine.inOut(t);
    },

    /**
     * Dissipation - starts slow, accelerates, then slows down
     */
    dissipation: (t: number): number => {
      return EasingFunctions.cubic.out(t);
    },

    /**
     * Morphing - subtle, wave-like changes
     */
    morphing: (t: number): number => {
      return (Math.sin(t * Math.PI * 2) + 1) / 2;
    },

    /**
     * Turbulence - irregular, natural variation
     */
    turbulence: (t: number): number => {
      const base = EasingFunctions.sine.inOut(t);
      const noise = Math.sin(t * Math.PI * 8) * 0.1;
      return Math.max(0, Math.min(1, base + noise));
    },

    /**
     * Fade in - gentle appearance
     */
    fadeIn: (t: number): number => {
      return EasingFunctions.quad.out(t);
    },

    /**
     * Fade out - gentle disappearance
     */
    fadeOut: (t: number): number => {
      return EasingFunctions.quad.in(1 - t);
    }
  };

  /**
   * Create a custom easing function by combining multiple functions
   */
  static combine(
    easing1: EasingFunction,
    easing2: EasingFunction,
    blend: number = 0.5
  ): EasingFunction {
    return (t: number): number => {
      const value1 = easing1(t);
      const value2 = easing2(t);
      return value1 * (1 - blend) + value2 * blend;
    };
  }

  /**
   * Create a stepped easing function
   */
  static steps(steps: number): EasingFunction {
    return (t: number): number => {
      return Math.floor(t * steps) / steps;
    };
  }

  /**
   * Create a custom bezier curve easing function
   */
  static bezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
    // Simplified cubic bezier implementation
    return (t: number): number => {
      const cx = 3 * x1;
      const bx = 3 * (x2 - x1) - cx;
      const ax = 1 - cx - bx;
      
      const cy = 3 * y1;
      const by = 3 * (y2 - y1) - cy;
      const ay = 1 - cy - by;
      
      const sampleCurveX = (t: number): number => {
        return ((ax * t + bx) * t + cx) * t;
      };
      
      const sampleCurveY = (t: number): number => {
        return ((ay * t + by) * t + cy) * t;
      };
      
      // Binary search to find t for given x
      let t0 = 0;
      let t1 = 1;
      let t2 = t;
      
      for (let i = 0; i < 8; i++) {
        const x = sampleCurveX(t2) - t;
        if (Math.abs(x) < 0.000001) break;
        
        if (x > 0) {
          t1 = t2;
        } else {
          t0 = t2;
        }
        t2 = (t1 + t0) / 2;
      }
      
      return sampleCurveY(t2);
    };
  }

  /**
   * Validate that a function is a proper easing function
   */
  static validate(easing: EasingFunction): boolean {
    try {
      const start = easing(0);
      const end = easing(1);
      const mid = easing(0.5);
      
      return (
        typeof start === 'number' &&
        typeof end === 'number' &&
        typeof mid === 'number' &&
        !isNaN(start) &&
        !isNaN(end) &&
        !isNaN(mid) &&
        start >= 0 &&
        end >= 0 &&
        mid >= 0
      );
    } catch {
      return false;
    }
  }
}