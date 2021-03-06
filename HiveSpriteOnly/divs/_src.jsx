var nls         = require('../config/i18n');
var choices     = require('../config/choices');
var defaults    = require('../config/defaults');
var settings    = require('../config/settings');
var take        = require('../lib/take');
var on          = require('../lib/on');
var _           = require('../lib/underscore');
var util        = require('../lib/util');

var CHC         = nls.CHC;
var DLG         = nls.DLG;
var UI          = nls.UI;
var MSG         = nls.MSG;
var BrowseUsing = choices.BrowseUsing;

var SOURCE = take({
  init: function ($) {
    this.separator = defaults.separator;
    this.dataList  = defaults.dataList;

    this.bindCtrls($);
    this.localizeUI();
    this.initView();
    this.bindEvents();
    this.reviveView();

    return this;
  },

  getData: function () {
    var dataList = _.clone(this.dataList);

    return util.inject({}, {
      'browseUsing'      : +this.ddlBrowseUsing.selection,
      'includeSubfolders': this.chkIncludeSubFolders.value,
      'previewImages'    : this.chkPreviewImages.value,

      'sourceImages'     : this.rejectSeparators(dataList),
      'groupedMarks'     : this.squashSeparators(dataList)
    });
  },

  rejectSeparators: function (dataList) {
    return _.reject(dataList, _.compose(
      _.partial(_.isEqual, _, this.separator),
      _.property('name')
    ), this);
  },

  squashSeparators: function (dataList) {
    var sep = this.separator;

    return _.chain(dataList)
      .map(function (item) {
        return item.name === sep ? sep : {};
      })
      .foldl(function (ret, item, idx, ary) {
        if (item !== sep || (idx !== 0 && ary[idx - 1] !== sep)) {
          ret.push(item);
        }
        return ret;
      }, [])
      .foldr(function (ret, item) {
        return _.isEmpty(ret) && item === sep ? ret : _(ret).unshift(item);
      }, [])
      .value();
  },

  bindCtrls: function ($) {
    _.each([
      'pnlSourceImages',
      'ddlBrowseUsing',
      'chkIncludeSubFolders',
      'chkPreviewImages',
      'lstSourceImages',
      'lblSourceImagesStat',

      'cmdBrowse',
      'cmdRemoveAll',
      'cmdRemove',
      'cmdInsertSeparator',
      'cmdMoveUp',
      'cmdMoveDown',

      'pnlImagePreview',
      'ddlBuildMethod'
    ], function (name) {
      this[name] = $(name);
    }, this);
  },

  localizeUI: function () {
    this.pnlSourceImages.text      = util.localize(UI.SOURCE_IMAGES);
    this.ddlBrowseUsing.title      = util.localize(UI.BROWSE_USING);
    this.chkIncludeSubFolders.text = util.localize(UI.INCLUDE_SUBFOLDERS);
    this.chkPreviewImages.text     = util.localize(UI.PREVIEW_IMAGES);

    this.cmdBrowse.text            = util.localize(UI.BROWSE);
    this.cmdRemoveAll.text         = util.localize(UI.REMOVE_ALL);
    this.cmdRemove.text            = util.localize(UI.REMOVE);
    this.cmdInsertSeparator.text   = util.localize(UI.INSERT_SEPARATOR);
    this.cmdMoveUp.text            = util.localize(UI.MOVE_UP);
    this.cmdMoveDown.text          = util.localize(UI.MOVE_DOWN);

    this.pnlImagePreview.text      = util.localize(UI.PREVIEW);

    if (util.zhify()) {
      this.ddlBrowseUsing.preferredSize = [180, -1];
      this.lstSourceImages.preferredSize = [600, -1];
    }
  },

  initView: function () {
    // initialize dropdownlist `Browse Use`
    _.each(BrowseUsing, function (index, text) {
      this.ddlBrowseUsing.add('item', util.localize(CHC[text]));
    }, this);

    this.ddlBrowseUsing.selection   = defaults.browseUsing;
    this.chkIncludeSubFolders.value = defaults.includeSubfolders;
    this.chkPreviewImages.value     = defaults.previewImages;

    this.renderListBox();
  },

  renderListBox: function () {
    this.lstSourceImages.removeAll();

    _.each(this.dataList, function (item) {
      this.lstSourceImages.add('item', item.path);
    }, this);
  },

  bindEvents: function () {
    var self                 = this;
    var ddlBrowseUsing       = self.ddlBrowseUsing;
    var chkIncludeSubFolders = self.chkIncludeSubFolders;
    var lstSourceImages      = self.lstSourceImages;
    var lblSourceImagesStat  = self.lblSourceImagesStat;
    var cmdBrowse            = self.cmdBrowse;
    var cmdRemoveAll         = self.cmdRemoveAll;
    var cmdRemove            = self.cmdRemove;
    var cmdInsertSeparator   = self.cmdInsertSeparator;
    var cmdMoveUp            = self.cmdMoveUp;
    var cmdMoveDown          = self.cmdMoveDown;
    var chkPreviewImages     = self.chkPreviewImages;
    var pnlImagePreview      = self.pnlImagePreview;

    on(cmdBrowse, 'click', function () {
      var images;

      switch (+ddlBrowseUsing.selection) {
      case BrowseUsing.FILES:
        var promptText = util.localize(DLG.SELECT_IMAGES);
        images = File.openDialog(promptText, util.dialogFilter(), true);
        break;
      case BrowseUsing.FOLDER:
        var folder = Folder.selectDialog(util.localize(DLG.TARGET_FOLDER));
        var recursive = chkIncludeSubFolders.value;
        images = folder && util[recursive ? 'getAllImages' : 'getImages'](folder);
        break;
      }

      if (_.isEmpty(images)) {
        return;
      }

      // filling data list with image info
      _.reduce(images, function (ret, image) {
        return _(ret).push({
          name: image.name,
          path: image.fsName
        });
      }, self.dataList);

      // remove separators
      self.dataList = self.rejectSeparators(self.dataList);

      // remove duplicates
      self.dataList = _.uniq(self.dataList, _.property('path'));

      self.renderListBox();
      self.trigger('listbox:update');
    });

    on(cmdInsertSeparator, 'click', function () {
      var selection = _(lstSourceImages.selection).sortBy('index');
      var separator = self.separator;
      var divisions = util.strRepeat(separator, 100);

      var tracks = _.reduce(selection, function (ret, item, index) {
        ret[1].push(index = item.index + ret[0]);

        self.dataList.splice(index, 0, {
          name: separator,
          path: divisions
        });

        return util.inject(ret, 0, ret[0] + 1);
      }, [0, []]);

      self.renderListBox();
      lstSourceImages.selection = tracks.pop();
      self.trigger('listbox:update');
    });

    on(cmdRemoveAll, 'click', function () {
      var confirmation = true;

      if (settings.confirmRemoveAll) {
        var message = util.localize(MSG.CONFIRM_REMOVE_ALL);
        confirmation = util.confirm(message);
      }

      if (confirmation) {
        lstSourceImages.removeAll();
        self.dataList.length = 0;
        self.trigger('listbox:update');
      }
    });

    on(cmdRemove, 'click', function () {
      var confirmation = true;

      if (settings.confirmRemove) {
        var message = util.localize(MSG.CONFIRM_REMOVE);
        confirmation = util.confirm(message);
      }

      if (!confirmation) {
        return;
      }

      var selection = _(lstSourceImages.selection).sortBy('index');
      var stayIndex = Math.max(0, selection[0].index - 1);

      _.foldr(selection, function (yes, item, index) {
        self.dataList.splice(item.index, 1);
      }, 'ignore me?');

      self.renderListBox();
      lstSourceImages.selection = stayIndex;
      self.trigger('listbox:update');
    });

    on(cmdMoveUp, 'click', function () {
      var item     = lstSourceImages.selection[0];
      var idx      = item.index - 1;
      var dataList = self.dataList;

      dataList.splice.apply(
        dataList,
        [idx, 2].concat(
          dataList.slice(idx, idx + 2).reverse()
        )
      );

      self.renderListBox();
      lstSourceImages.selection = idx;
      self.trigger('listbox:update');
    });

    on(cmdMoveDown, 'click', function () {
      var item     = lstSourceImages.selection[0];
      var idx      = item.index;
      var dataList = self.dataList;

      dataList.splice.apply(
        dataList,
        [idx, 2].concat(
          dataList.slice(idx, idx + 2).reverse()
        )
      );

      self.renderListBox();
      lstSourceImages.selection = idx + 1;
      self.trigger('listbox:update');
    });

    on(ddlBrowseUsing, 'change', _.bind(self.trigger, self, 'browseusing:change'));
    on(lstSourceImages, 'click', _.bind(self.trigger, self, 'listbox:update'));
    on(chkPreviewImages, 'click', toggleImagePreview);

    on(self, {
      'browseusing:change': browseUseChanged,
      'listbox:update': listboxChanged
    });

    function browseUseChanged() {
      var useFolder = (+ddlBrowseUsing.selection === BrowseUsing.FOLDER);
      chkIncludeSubFolders.enabled = useFolder;
    }

    function listboxChanged() {
      updateListBox();
      toggleImagePreview();
    }

    function updateListBox() {
      var selection = lstSourceImages.selection;
      var items     = lstSourceImages.items;
      var length    = items.length;

      if (!length) {
        util.disable([cmdRemoveAll, cmdRemove, cmdInsertSeparator, cmdMoveUp, cmdMoveDown]);
      } else if (!selection) {
        util.enable(cmdRemoveAll);
        util.disable([cmdRemove, cmdInsertSeparator, cmdMoveUp, cmdMoveDown]);
      } else if (selection.length === 1) {
        if (length === 1) {
          util.disable([cmdMoveUp, cmdMoveDown]);
        } else {
          switch (selection[0].index) {
          case 0:
            util.disable(cmdMoveUp);
            util.enable(cmdMoveDown);
            break;
          case length - 1:
            util.disable(cmdMoveDown);
            util.enable(cmdMoveUp);
            break;
          default:
            util.enable([cmdMoveUp, cmdMoveDown]);
            break;
          }
        }

        util.enable([cmdRemoveAll, cmdRemove, cmdInsertSeparator]);
      } else {
        util.enable([cmdRemoveAll, cmdRemove, cmdInsertSeparator]);
        util.disable([cmdMoveUp, cmdMoveDown]);
      }

      var images = _.reject(selection || (selection = []), function (item) {
        return self.dataList[item.index].name === self.separator;
      });

      updateStatInfo(length, selection.length, images.length);
    }

    function updateStatInfo(total, selected, img_num) {
      var tmpl = [
        '${total}: ${tot_num}',
        '${selected}: ${sel_num}',
        '${images}: ${img_num}'
      ].join('   ');

      lblSourceImagesStat.text = util.vsub(tmpl, {
        'total'   : util.localize(UI.TOTAL),
        'tot_num' : total,
        'selected': util.localize(UI.SELECTED),
        'sel_num' : selected,
        'images'  : util.localize(UI.IMAGES),
        'img_num' : img_num
      });
    }

    function toggleImagePreview() {
      if (chkPreviewImages.value) {
        updateImagePreview();
      } else {
        pnlImagePreview.visible = false;
      }
    }

    function updateImagePreview() {
      var selection   = lstSourceImages.selection;
      var imgControls = pnlImagePreview.children;
      var imgCount    = imgControls.length;

      pnlImagePreview.visible = true;
      _.each(imgControls, function (img) {
        img.visible = false;
      });

      if (selection) {
        var dataList  = self.dataList;
        var separator = self.separator;

        selection = _.chain(selection)
          .sortBy('index')
          .reject(function (item) {
            return dataList[item.index].name === separator;
          })
          .value()
          .slice(0, imgCount);

        if (_.isEmpty(selection)) {
          pnlImagePreview.visible = false;
          return;
        }

        _.each(selection, function (item, index, image) {
          image         = imgControls[index];
          image.image   = dataList[item.index].path;
          image.visible = true;
        });
      } else {
        pnlImagePreview.visible = false;
      }
    }
  },

  reviveView: function () {
    this.trigger('browseusing:change');
    this.trigger('listbox:update');
  }
});

module.exports = function ($) {
  return (new SOURCE).init($);
};
