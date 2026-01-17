import {
  Component,
  effect,
  ElementRef,
  input,
  model,
  OnDestroy,
  OnInit,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { Crepe } from '@milkdown/crepe';
import { BrowserModule } from '@angular/platform-browser';

@Component({
  selector: 'app-crepe',
  templateUrl: './crepe.component.html',
  styleUrl: './crepe.component.scss',
  encapsulation: ViewEncapsulation.None,
  imports: [BrowserModule],
})
export class CrepeComponent implements OnInit, OnDestroy {
  markdown = model('');
  readonly = input(false);

  crepe: Crepe | null = null;
  root = viewChild.required<ElementRef>('root');

  async setMarkdown(markdown: string) {
    await this.reinitCrepe(markdown);
    this.markdown.set(markdown);
  }

  async reinitCrepe(markdown: string) {
    if (this.crepe) await this.crepe.destroy();
    let root = this.root().nativeElement;
    this.crepe = new Crepe({ root, defaultValue: markdown })
      .setReadonly(this.readonly())
      .on((listener) =>
        listener.markdownUpdated(() => {
          if (!this.crepe) return;
          this.markdown.set(this.crepe.getMarkdown());
        })
      );
    await this.crepe.create();
  }

  async ngOnInit() {
    await this.reinitCrepe(this.markdown());
  }

  async ngOnDestroy() {
    if (this.crepe) await this.crepe.destroy();
  }
}
