"use client";

import React, { useRef, useState, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Send, Phone, Mail, MapPin, GraduationCap, Building2, Briefcase } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const ContactSectionGSAP = () => {
    const sectionRef = useRef<HTMLDivElement>(null);
    const [profileType, setProfileType] = useState<'student' | 'school' | 'pro'>('school');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        organization: '',
        message: ''
    });

    const profiles = {
        school: {
            icon: Building2,
            label: "Établissement",
            subtitle: "Audit & Solutions IA",
            fields: {
                organization: { label: "Nom de l'établissement", placeholder: "Lycée Pilote..." },
                options: ["Audit IA", "Korrigo", "Formation Staff"]
            }
        },
        student: {
            icon: GraduationCap,
            label: "Élève / Parent",
            subtitle: "Accompagnement Élite",
            fields: {
                organization: { label: "Niveau scolaire", placeholder: "Terminale, Prépa..." },
                options: ["Cours Particuliers", "Stage Vacances", "Coaching Orientation"]
            }
        },
        pro: {
            icon: Briefcase,
            label: "Professionnel",
            subtitle: "Formation Continue",
            fields: {
                organization: { label: "Entreprise / Secteur", placeholder: "Tech, Banque..." },
                options: ["Certification Web3", "Bootcamp IA", "Upskilling"]
            }
        }
    };

    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            const mm = gsap.matchMedia();

            mm.add("(prefers-reduced-motion: no-preference)", () => {
                gsap.fromTo('.animate-item',
                    { y: 30, opacity: 0 },
                    {
                        scrollTrigger: {
                            trigger: sectionRef.current,
                            start: 'top 70%',
                        },
                        y: 0,
                        opacity: 1,
                        stagger: 0.1,
                        duration: 0.8,
                        ease: 'power3.out'
                    }
                );
            });

            mm.add("(prefers-reduced-motion: reduce)", () => {
                gsap.set('.animate-item', { opacity: 1, y: 0 });
            });
        }, sectionRef);

        return () => ctx.revert();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Form submitted:', { ...formData, profile: profileType });
        // Add real submission logic here
    };

    const currentProfile = profiles[profileType];

    return (
        <section ref={sectionRef} id="contact" className="relative py-24 bg-neutral-950">

            <div className="max-w-7xl mx-auto px-6">

                {/* Header */}
                <div className="text-center mb-16 animate-item">
                    <span className="font-mono text-xs uppercase tracking-[0.2em] text-nexus-cyan mb-4 block">
                        Démarrer la transformation
                    </span>
                    <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
                        Parlons de votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Avenir</span>
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        Que vous souhaitiez moderniser votre établissement ou exceller dans vos études,
                        nos experts construisent la solution adaptée.
                    </p>
                </div>

                {/* Profile Selector */}
                <div className="animate-item flex flex-wrap justify-center gap-4 mb-12">
                    {(Object.entries(profiles) as [keyof typeof profiles, typeof profiles.school][]).map(([key, p]) => {
                        const isActive = profileType === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setProfileType(key)}
                                className={`flex items-center gap-3 px-6 py-4 rounded-xl border transition-all duration-300 ${isActive
                                    ? 'bg-nexus-cyan/10 border-nexus-cyan text-nexus-cyan shadow-[0_0_20px_rgba(46,233,246,0.1)]'
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
                                    }`}
                            >
                                <p.icon className="w-5 h-5" />
                                <div className="text-left">
                                    <span className="block font-medium text-sm">{p.label}</span>
                                    <span className={`block text-xs ${isActive ? 'text-white/70' : 'text-gray-500'}`}>
                                        {p.subtitle}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

                    {/* Left - Contact Info */}
                    <div className="animate-item lg:col-span-2 space-y-6">
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                            <h3 className="font-display text-lg font-semibold text-white mb-4">
                                Contact direct
                            </h3>

                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                        <Phone className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <span className="block text-gray-500 text-xs">Téléphone</span>
                                        <span className="block text-white font-medium">+216 99 19 28 29</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                        <Mail className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <span className="block text-gray-500 text-xs">Email</span>
                                        <span className="block text-white font-medium">contact@nexusreussite.academy</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                        <MapPin className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <span className="block text-gray-500 text-xs">Adresse</span>
                                        <span className="block text-white font-medium text-sm">
                                            Centre Urbain Nord, Immeuble VENUS<br />
                                            1082 – Tunis
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Options */}
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                            <h3 className="font-display text-sm font-semibold text-white mb-4">
                                Je suis intéressé par :
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {currentProfile.fields.options.map((option, idx) => (
                                    <span
                                        key={idx}
                                        className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-gray-300
                             border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
                                    >
                                        {option}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right - Form */}
                    <div className="animate-item lg:col-span-3">
                        <form
                            onSubmit={handleSubmit}
                            className="p-8 rounded-2xl bg-white/5 border border-white/10"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                <div>
                                    <label htmlFor="name" className="block text-gray-400 text-xs mb-2">Nom complet</label>
                                    <input
                                        id="name"
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Votre nom"
                                        className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3.5 
                              text-white text-sm placeholder:text-gray-600 
                              focus:border-blue-500 focus:outline-none transition-colors"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="email" className="block text-gray-400 text-xs mb-2">Email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="email@exemple.com"
                                        className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3.5 
                              text-white text-sm placeholder:text-gray-600 
                              focus:border-blue-500 focus:outline-none transition-colors"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                <div>
                                    <label htmlFor="phone" className="block text-gray-400 text-xs mb-2">Téléphone</label>
                                    <input
                                        id="phone"
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+216 XX XXX XXX"
                                        className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3.5 
                              text-white text-sm placeholder:text-gray-600 
                              focus:border-blue-500 focus:outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="organization" className="block text-gray-400 text-xs mb-2">
                                        {currentProfile.fields.organization.label}
                                    </label>
                                    <input
                                        id="organization"
                                        type="text"
                                        value={formData.organization}
                                        onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                                        placeholder={currentProfile.fields.organization.placeholder}
                                        className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3.5 
                              text-white text-sm placeholder:text-gray-600 
                              focus:border-blue-500 focus:outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="mb-6">
                                <label htmlFor="message" className="block text-gray-400 text-xs mb-2">Message (optionnel)</label>
                                <textarea
                                    id="message"
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    placeholder="Décrivez brièvement votre besoin..."
                                    rows={4}
                                    className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3.5 
                            text-white text-sm placeholder:text-gray-600 resize-none
                            focus:border-blue-500 focus:outline-none transition-colors"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-semibold
                          bg-gradient-to-r from-blue-500 to-cyan-500 text-white
                          hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300
                          hover:scale-[1.02] group"
                            >
                                <span>Envoyer ma demande</span>
                                <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>

                            <p className="text-center text-gray-500 text-xs mt-4">
                                Notre équipe vous répond sous 24h ouvrées.
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ContactSectionGSAP;
