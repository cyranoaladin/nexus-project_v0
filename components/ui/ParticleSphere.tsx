'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ParticleSphere() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    // Configuration de la scène
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050a14, 0.15);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    // Configuration du rendu
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountEl.appendChild(renderer.domElement);

    // Création des particules
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 3000;
    
    const posArray = new Float32Array(particlesCount * 3);
    
    for (let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 5;
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    
    // Matériau des particules
    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.008,
      color: '#C5A059',
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    
    // Création du système de particules
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);
    
    // Positionnement de la caméra
    camera.position.z = 2;
    
    // Animation
    let mouseX = 0;
    let mouseY = 0;
    
    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    // Fonction d'animation
    const animate = () => {
      requestAnimationFrame(animate);
      
      particlesMesh.rotation.y += 0.001;
      particlesMesh.rotation.x += 0.0005;
      
      // Effet de souris
      camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.05;
      camera.position.y += (-mouseY * 0.5 - camera.position.y) * 0.05;
      camera.lookAt(scene.position);
      
      renderer.render(scene, camera);
    };
    
    // Gestion du redimensionnement
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Démarrer l'animation
    animate();
    
    // Nettoyage
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      mountEl.removeChild(renderer.domElement);
    };
  }, []);
  
  return <div ref={mountRef} className="absolute inset-0" />;
}
