import { CircleHelp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useState } from 'react';
import helpContent from '@/lib/helpContent';

interface InfoButtonProps {
  helpId: string;
  className?: string;
}

const InfoButton = ({ helpId, className = '' }: InfoButtonProps) => {
  const [open, setOpen] = useState(false);
  const content = helpContent[helpId];

  if (!content) return null;

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors hover:bg-muted/50 focus:outline-none ${className}`}
        aria-label={`Ajuda: ${content.title}`}
      >
        <CircleHelp className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{content.title}</DialogTitle>
            <DialogDescription className="sr-only">Informações sobre {content.title}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Como Funciona
              </h4>
              <p className="text-sm leading-relaxed text-foreground/90">
                {content.description}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                💡 Dicas de Mestre
              </h4>
              <ul className="space-y-2">
                {content.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/80">
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InfoButton;
