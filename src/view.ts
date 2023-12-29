import { Notice, requestUrl, ItemView, WorkspaceLeaf, moment, TFile } from 'obsidian';
import MyPlugin, {VIEW_TYPE} from './main';
import { GridView, ThumbnailImage } from './renderer'
import { dateToGoogleDateFilter, GooglePhotosDateFilter } from 'photosApi'
import { handlebarParse } from './handlebars'

export class DailyPhotosView extends ItemView {
    // vueApp: App;
    plugin: MyPlugin;
    gridView: GridView;
    photoDate: string | undefined;
    container: Element;
    file: TFile | undefined;
    googlePhotoMoment: moment.Moment | undefined;
    googlePhoto: ThumbnailImage | undefined;
    popover: HTMLDivElement | undefined;
    popoverImg: HTMLImageElement | undefined;
    popoverExtLink: HTMLAnchorElement | undefined;
    popoverCopyLink: HTMLAnchorElement | undefined;

    constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
        super(leaf);
        this.plugin = plugin;

		// rerender at midnight
		this.registerInterval(
			window.setInterval(
				() => {
                    // console.log(this.photoDate, this.plugin.currentFile)
                    if (this.googlePhotoMoment?.format('YYYY-MM-DD') !== this.plugin.googlePhotoMoment?.format('YYYY-MM-DD')) {
                        this.googlePhotoMoment = this.plugin.googlePhotoMoment;
                        this.file = this.plugin.viewFile
                        this.updateView();
                    }
				},
				1700,
			),
		);
    }

    getViewType(): string {
        return VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Daily Google Photos";
    }

    getIcon(): string {
        return "camera";
    }

    async insertImageIntoEditor(event: MouseEvent) {
        //console.log(event)
        const googlePhoto = <ThumbnailImage>event.target
        if (this.popover && this.popoverImg && this.popoverExtLink && this.popoverCopyLink) {
            this.popover.style.display = ''
            this.popoverImg.src = googlePhoto.baseUrl
            this.popoverImg.alt = googlePhoto.filename
            // this.popoverImg.style.width = '100%'
            this.popoverExtLink.href = googlePhoto.productUrl
            this.popoverExtLink.target = '_blank'

            this.popoverCopyLink.onclick = async () => {
                // let editor = this.plugin.app.workspace.;
                // console.log(editor)
                // if (!editor) return;
        
                await this.importIntoVault(googlePhoto)
            }
            // this.popover.style.visibility = ''
            // popover.innerHTML = '<a href="' + googlePhoto.productUrl + '" target="_blank">Go To Google Photos</a>'
            // popover.innerHTML += ' | '
            // popover.innerHTML += '<a href="' + googlePhoto.productUrl + '" target="_blank">Insert image into vault and copy link into clipboard</a>'
            // popover.innerHTML += '<img style="width:100%;" src="' + googlePhoto.baseUrl + '">'
        }
    }

    async onOpen(this: DailyPhotosView) {
        this.container = this.containerEl.children[1];
        this.container.empty();
        this.gridView = new GridView({
            scrollEl: this.containerEl,
            plugin: this.plugin,
            onThumbnailClick: event => this.insertImageIntoEditor(event)
        })
        // Attach the grid view to the modal
        this.container.appendChild(this.gridView.containerEl)

        this.popover = this.container.createEl('div', {})
        this.popover.style.position = 'absolute'
        this.popover.style.top = '0px'
        this.popover.style.left = '0px'
        this.popover.style.width = '100%'
        this.popover.style.height = '100%'
        this.popover.style.display = 'none'
        this.popover.style.justifyContent = 'center'
        this.popover.style.alignItems = 'center'
        this.popover.style.backgroundColor = 'rgba(0,0,0,0.9)'
        this.popover.style.zIndex = '1000'
        this.popover.style.padding = '10px'
        // this.popover.style.display = 'none'
        // this.popover.style.visibility = 'hidden'
        // this.popover.style.opacity = '0'
        this.popover.style.transition = 'opacity 0.5s'
        const popoverEl = this.popover

        this.popoverExtLink = this.popover.createEl('a', {href: '', text: 'Go To Google Photos'})
        this.popover.createEl('span', {text: ' | '})
        this.popoverCopyLink = this.popover.createEl('a', {href: '', text: 'Copy image into vault and link into clipboard'})
        this.popoverImg = this.popover.createEl('img', {attr: {'class': 'google-photos-grid-thumbnail'}})
        this.popoverImg.addEventListener('click', () => {
            popoverEl.style.display = 'none'
            // popoverEl.empty()
        })
        // this.popoverCopyLink.addEventListener('click', async () => {
        //     let editor = this.plugin.app.workspace.activeEditor;
        //     if (!editor) return;

        //     await this.importIntoVault(editor)
        // })
        // this.container.appendChild(this.popover)
    }

    async importIntoVault(thumbnailImage?: ThumbnailImage) {
        try {
            // Remove the photo grid and just show the loading spinner while we wait for the thumbnail to download
            // const thumbnailImage = <ThumbnailImage>event.target
            const src = this.popoverImg?.src || ''
            const noteFolder = this.file?.path.split('/').slice(0, -1).join('/')
            // Use the note folder or the user-specified folder from Settings
            let thumbnailFolder = noteFolder
            let linkPath = this.popoverImg?.alt || ''
            switch (this.plugin.settings.locationOption) {
              case 'specified':
                thumbnailFolder = this.plugin.settings.locationFolder
                // Set the Markdown image path to be the full specified path + filename
                linkPath = thumbnailFolder + '/' + this.popoverImg?.alt
                break
              case 'subfolder':
                thumbnailFolder = noteFolder + '/' + this.plugin.settings.locationSubfolder
                // Set the Markdown image path to be the subfolder + filename
                linkPath = this.plugin.settings.locationSubfolder + '/' + this.popoverImg?.alt
                break
            }
            thumbnailFolder = thumbnailFolder?.replace(/^\/+/, '').replace(/\/+$/, '') || '' // remove any leading/trailing slashes
            linkPath = encodeURI(linkPath)
            // Check to see if the destination folder exists
            const vault = this.plugin.app.vault
            if (!await vault.adapter.exists(thumbnailFolder)) {
              // Create the folder if not already existing. This works to any depth
              await vault.createFolder(thumbnailFolder)
            }
            // Fetch the thumbnail from Google Photos
            const imageData = await requestUrl({ url: src })
            await this.plugin.app.vault.adapter.writeBinary(thumbnailFolder + '/' + this.popoverImg?.alt, imageData.arrayBuffer)
            // const cursorPosition = editor.getCursor()
            const linkText = handlebarParse(this.plugin.settings.thumbnailMarkdown, {
              local_thumbnail_link: linkPath,
              google_photo_id: thumbnailImage?.photoId,
              google_photo_url: thumbnailImage?.productUrl,
              google_base_url: thumbnailImage?.baseUrl,
              taken_date: thumbnailImage?.creationTime.format()
            })
            navigator.clipboard.writeText(linkText)

            // notification
            new Notice('Successfully copied link to clipboard')


            // this.editor.replaceRange(linkText, cursorPosition)
            // Move the cursor to the end of the thumbnail link after pasting
            // this.editor.setCursor({ line: cursorPosition.line, ch: cursorPosition.ch + linkText.length })
          } catch (e) {
            console.log(e)
          }
    }

    // isDailyNotesEnabled() {
    //     const dailyNotesPlugin = this.app.internalPlugins.plugins["daily-notes"];
    //     const dailyNotesEnabled = dailyNotesPlugin && dailyNotesPlugin.enabled;
    
    //     const periodicNotesPlugin = this.app.plugins.getPlugin("periodic-notes");
    //     const periodicNotesEnabled =
    //       periodicNotesPlugin && periodicNotesPlugin.settings?.daily?.enabled;
    
    //     return dailyNotesEnabled || periodicNotesEnabled;
    // }

    async updateView() {
        // let { folder, format } = getDailyNoteSettings();
        // console.log(format, this.plugin.currentFilePath)

        // if (!this.isDailyNotesEnabled()) return;
        // if (!this.plugin.currentFile) return;
        // if (!this.plugin.currentFilePath) return;
        // if (!this.plugin.currentFilePath.endsWith('.md')) return;

        // let filePathWithoutExt = this.plugin.currentFilePath.substring(0, this.plugin.currentFilePath.length - 3);
        // if (folder) {
        //     console.log(folder);
        //     if (!filePathWithoutExt.startsWith(folder)) return;
        //     console.log(filePathWithoutExt.substring(folder.length + 1), format);
        //     if (!moment(filePathWithoutExt.substring(folder.length + 1), format, true).isValid()) return;
        // }
        // else {
        //     if (!moment(filePathWithoutExt, format, true).isValid()) return;
        // }
        // console.log('passed!')

        const date = this.googlePhotoMoment?.format('YYYY-MM-DD')
        if (date === 'Invalid date') {
            this.gridView.resetGrid()
            this.gridView.setTitle("No date found")
            this.gridView.spinner.style.display = 'none'
            return;
        }

        const xDaysBeforeDate = moment(date).subtract(0, 'days')
        const xDaysAfterDate = moment(date).add(0, 'days')
        const dateFilter: GooglePhotosDateFilter = {
            ranges: [{
                startDate: dateToGoogleDateFilter(xDaysBeforeDate),
                endDate: dateToGoogleDateFilter(xDaysAfterDate)
            }]
        } as object
        this.gridView.resetGrid()
        this.gridView.setTitle(date ? date : "No date found")
        this.gridView.setSearchParams({
            filters: {
                dateFilter
            },
            orderBy: "MediaMetadata.creation_time"
        })
        this.gridView.getThumbnails().then()
    }

    async onClose() {
        this.gridView?.destroy()
    }
    onunload(): void {
    }
}