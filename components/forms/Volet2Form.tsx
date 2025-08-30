'use client';
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, HelpCircle, Loader2 } from "lucide-react";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Adapter (fourni dans le canvas: volet2_adapter.ts)
import { adaptVolet2FormData } from "@/packages/shared/scoring/volet2_adapter";

// === Types du schéma JSON ===
// On s'aligne sur la structure du document "Volet 2 — Questionnaire pédagogique enrichi (JSON)"

type LikertRef = "FREQ4" | "AGREE5" | "CONF4" | "MOTIV5" | "STRESS5";

type ItemBase = {
  id: string;
  type: "single" | "multi" | "text" | "likert";
  label: string;
  options?: string[];
  optionsRef?: string; // pointer vers optionsPresets
  scaleRef?: LikertRef; // pour likert
  placeholder?: string;
  maxlength?: number;
  min?: number;
  max?: number;
  required?: boolean;
  visibleIf?: Record<string, string | string[]>; // logique simple: valeur exacte ou dans une liste
};

type Section = {
  label: string;
  items: ItemBase[];
};

type Volet2Schema = {
  meta: {
    title: string;
    version: string;
    locale: string;
    sectionsOrder: string[];
  };
  optionsPresets: Record<string, string[]>;
  likertPresets: Record<string, string[]>;
  sections: Record<string, Section>;
};

// ==== Composants UI spécifiques ====

function FieldHelp({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
      <HelpCircle className="h-4 w-4" />
      <span>{children}</span>
    </div>
  );
}

function MultiSelect({
  name,
  label,
  options,
  max,
  control,
  required,
}: {
  name: string;
  label: string;
  options: string[];
  max?: number;
  control: any;
  required?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="space-y-2">
          <Label className="font-medium">{label}{required ? " *" : ""}</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {options.map((opt) => {
              const checked = Array.isArray(field.value) && field.value.includes(opt);
              return (
                <label key={opt} className={`flex items-center gap-2 rounded-xl border p-3 cursor-pointer ${checked ? "border-primary bg-primary/5" : "border-secondary"}`}>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      const arr = Array.isArray(field.value) ? [...field.value] : [];
                      if (v) {
                        if (!max || arr.length < max) arr.push(opt);
                      } else {
                        const i = arr.indexOf(opt);
                        if (i >= 0) arr.splice(i, 1);
                      }
                      field.onChange(arr);
                    }}
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
          {max ? <FieldHelp>Sélection maximale : {max}</FieldHelp> : null}
        </div>
      )}
    />
  );
}

function SingleSelect({ name, label, options, control, required }: { name: string; label: string; options: string[]; control: any; required?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="space-y-2">
          <Label className="font-medium">{label}{required ? " *" : ""}</Label>
          <Select value={field.value || undefined} onValueChange={field.onChange}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    />
  );
}

function Likert({ name, label, scale, control }: { name: string; label: string; scale: string[]; control: any }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="space-y-2">
          <Label className="font-medium">{label}</Label>
          <RadioGroup value={field.value || ""} onValueChange={field.onChange} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {scale.map((lab, i) => (
              <div key={lab} className="flex items-center space-x-2 rounded-xl border p-3">
                <RadioGroupItem value={lab} id={`${name}-${i}`} />
                <Label htmlFor={`${name}-${i}`}>{lab}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}
    />
  );
}

function TextField({ name, label, placeholder, control, maxlength }: { name: string; label: string; placeholder?: string; control: any; maxlength?: number }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="space-y-2">
          <Label className="font-medium">{label}</Label>
          <Textarea placeholder={placeholder} maxLength={maxlength} {...field} />
          {maxlength ? <FieldHelp>Max {maxlength} caractères</FieldHelp> : null}
        </div>
      )}
    />
  );
}

// ===== Validateur Zod dynamique (les champs requis du schéma)
function buildZodSchema(schema: Volet2Schema) {
  const shape: Record<string, any> = {};
  schema.meta.sectionsOrder.forEach((secKey) => {
    const section = schema.sections[secKey];
    section.items.forEach((it) => {
      if (!it.required) return;
      switch (it.type) {
        case "single":
        case "likert":
          shape[it.id] = z.string({ required_error: "Champ requis" });
          break;
        case "multi":
          shape[it.id] = z.array(z.string()).min(1, { message: "Sélectionner au moins une option" });
          break;
        case "text":
          shape[it.id] = z.string().min(1, { message: "Veuillez renseigner ce champ" });
          break;
        default:
          break;
      }
    });
  });
  return z.object(shape);
}

// ===== Logic visibleIf (AND sur les paires id=valeur)
function isVisible(item: ItemBase, values: Record<string, any>) {
  if (!item.visibleIf) return true;
  return Object.entries(item.visibleIf).every(([dep, expected]) => {
    const v = values[dep];
    if (Array.isArray(expected)) return expected.includes(v);
    return v === expected;
  });
}

// ===== Wizard/étapes =====

export default function Volet2Form({ schema, onFormSubmit }: { schema: Volet2Schema, onFormSubmit: (data: any) => void }) {
  const [step, setStep] = useState(0);
  const steps = schema.meta.sectionsOrder;
  const zodSchema = useMemo(() => buildZodSchema(schema), [schema]);

  const methods = useForm({ resolver: zodResolver(zodSchema), mode: "onChange", defaultValues: {} });
  const { control, handleSubmit, watch, formState } = methods;
  const allValues = watch();

  const progress = Math.round(((step + 1) / steps.length) * 100);

  const onSubmit = (data: any) => {
    const exportPayload = adaptVolet2FormData(data);
    onFormSubmit(exportPayload);
  };

  return (
    <FormProvider {...methods}>
      <div className="max-w-5xl mx-auto p-4 sm:p-8">
        <Card className="shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl sm:text-3xl font-semibold">{schema.meta.title}</CardTitle>
            <div className="text-sm text-muted-foreground">Version {schema.meta.version} • {schema.meta.locale}</div>
            <div className="mt-4"><Progress value={progress} /></div>
          </CardHeader>
          <CardContent>
            <Tabs value={steps[step]} className="w-full">
              <TabsList className="hidden sm:grid grid-cols-4 gap-2 w-full">
                {steps.map((key, i) => (
                  <TabsTrigger key={key} value={key} disabled className="truncate">
                    {schema.sections[key].label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <AnimatePresence mode="wait">
                <motion.div
                  key={steps[step]}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="mt-2"
                >
                  <SectionForm sectionKey={steps[step]} schema={schema} control={control} values={allValues} />
                </motion.div>
              </AnimatePresence>
            </Tabs>
            <Separator className="my-6" />
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Précédent
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">Étape {step + 1} / {steps.length}</Badge>
              </div>
              {step < steps.length - 1 ? (
                <Button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
                  Suivant <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit(onSubmit)} disabled={!formState.isValid || formState.isSubmitting}>
                  {formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Soumettre
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </FormProvider>
  );
}

function SectionForm({ sectionKey, schema, control, values }: { sectionKey: string; schema: Volet2Schema; control: any; values: any }) {
  const section = schema.sections[sectionKey];
  const getOptions = (it: ItemBase) => (it.optionsRef ? schema.optionsPresets[it.optionsRef] : it.options || []);
  const getScale = (it: ItemBase) => (it.scaleRef ? schema.likertPresets[it.scaleRef] : []);

  return (
    <div className="grid gap-6">
      <h3 className="text-xl font-semibold">{section.label}</h3>
      <div className="grid gap-6">
        {section.items.map((it) => {
          if (!isVisible(it, values)) return null;
          switch (it.type) {
            case "single":
              return (
                <SingleSelect key={it.id} name={it.id} label={it.label} options={getOptions(it)} control={control} required={it.required} />
              );
            case "multi":
              return (
                <MultiSelect key={it.id} name={it.id} label={it.label} options={getOptions(it)} control={control} max={it.max} required={it.required} />
              );
            case "likert":
              return <Likert key={it.id} name={it.id} label={it.label} scale={getScale(it)} control={control} />;
            case "text":
              return <TextField key={it.id} name={it.id} label={it.label} placeholder={it.placeholder} maxlength={it.maxlength} control={control} />;
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}

