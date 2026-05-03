use wasm_bindgen::prelude::*;
use std::f64::consts::PI;

#[wasm_bindgen]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[wasm_bindgen]
pub fn rotate_vector(x: f64, y: f64, angle_deg: f64) -> Point {
    let angle_rad = angle_deg * PI / 180.0;
    let cos_a = angle_rad.cos();
    let sin_a = angle_rad.sin();
    
    Point {
        x: x * cos_a - y * sin_a,
        y: x * sin_a + y * cos_a,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rotate_90_degrees() {
        let p = rotate_vector(1.0, 0.0, 90.0);
        // Assert rotation of (1,0) by 90 deg is (0,1)
        assert!(p.x.abs() < 1e-10);
        assert!((p.y - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_rotate_180_degrees() {
        let p = rotate_vector(1.0, 0.0, 180.0);
        // Assert rotation of (1,0) by 180 deg is (-1,0)
        assert!((p.x + 1.0).abs() < 1e-10);
        assert!(p.y.abs() < 1e-10);
    }
}
