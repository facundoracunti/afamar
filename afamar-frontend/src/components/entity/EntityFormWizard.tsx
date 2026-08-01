import React, { type ReactNode } from 'react';
import styles from './EntityFormWizard.module.css';

const s = styles as unknown as Record<string, string>;

export interface EntityFormWizardStep {
  id: string;
  label: string;
  description: string;
  content: ReactNode;
}

interface EntityFormWizardProps {
  steps: EntityFormWizardStep[];
  activeStep: number;
  onStepChange: (index: number) => void;
  onCancel: () => void;
  saving: boolean;
}

export default function EntityFormWizard({
  steps,
  activeStep,
  onStepChange,
  onCancel,
  saving,
}: EntityFormWizardProps) {
  const safeStep = Math.min(Math.max(activeStep, 0), Math.max(steps.length - 1, 0));
  const current = steps[safeStep];
  const isFirst = safeStep === 0;
  const isLast = safeStep === steps.length - 1;

  return (
    <div className={s['entity-form-wizard']}>
      <nav className={s['entity-form-wizard__nav']} aria-label="Pasos del formulario">
        <div className={s['entity-form-wizard__progress']}>
          Paso {safeStep + 1} de {steps.length}
        </div>
        <ol className={s['entity-form-wizard__steps']}>
          {steps.map((step, index) => (
            <li key={step.id} className={index === safeStep ? s['entity-form-wizard__step--active'] : ''}>
              <button
                type="button"
                className={s['entity-form-wizard__step-button']}
                onClick={() => onStepChange(index)}
                aria-current={index === safeStep ? 'step' : undefined}
              >
                <span className={s['entity-form-wizard__step-number']}>{index + 1}</span>
                <span className={s['entity-form-wizard__step-copy']}>
                  <strong>{step.label}</strong>
                  <small>{step.description}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className={s['entity-form-wizard__content']}>
        {steps.map((step, index) => (
          <section
            key={step.id}
            className={s['entity-form-wizard__panel']}
            hidden={index !== safeStep}
            aria-labelledby={`wizard-step-${step.id}`}
          >
            <div className={s['entity-form-wizard__panel-heading']}>
              <div>
                <span className={s['entity-form-wizard__eyebrow']}>Paso {index + 1}</span>
                <h3 id={`wizard-step-${step.id}`}>{step.label}</h3>
                <p>{step.description}</p>
              </div>
            </div>
            {step.content}
          </section>
        ))}
      </div>

      <div className={s['entity-form-wizard__footer']} aria-label="Navegación del formulario">
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancelar
        </button>
        <div className={s['entity-form-wizard__footer-actions']}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onStepChange(safeStep - 1)}
            disabled={isFirst}
          >
            Anterior
          </button>
          {isLast ? (
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'GUARDANDO...' : 'GUARDAR'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => onStepChange(safeStep + 1)}>
              Siguiente
            </button>
          )}
        </div>
        <span className={s['entity-form-wizard__current']} aria-live="polite">
          {current?.label}
        </span>
      </div>
    </div>
  );
}
