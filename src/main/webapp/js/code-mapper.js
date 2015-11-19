
"use strict";

/**
 * The initial state that is used when no state is found for the case
 * definition.
 */
var INITIAL = {
    caseDefinition: "",
    history: [],
    concepts: [],
    codingSystems: [ "ICD9CM", "ICD10CM", "ICPC2P", "ICPC2EENG", "RCD", "RCD2" ]
};

var SHOW_UMLS_COLUMN = false;
var FILTER_BY_STOPWORDS = false;

/**
 * Concepts found by Peregrine are filtered by a stopword list and by the
 * following regex matching three-digit numbers and two-letter words.
 */
var STOPWORDS_REGEX = /^(\d{1,3}|\S{1,2})$/;

function historyDatumToString(data) {
    if (data == null) {
        return null;
    } else if (angular.isString(data)) {
        return data;
    } else if (angular.isArray(data)) {
        return data.map(function(concept) { return concept.preferredName.replace(/,/g, " "); }).join(", ");
    } else if (angular.isObject(data)) {
        return data.preferredName;
    }
}

function handleError(err, status) {
    if (status == 401) {
        alert("Your session has timed out :( You have to re-login!");
    } else {
        alert(err, status);
    }
}

function upgradeState(state) {
    state = angular.copy(state);
    if (!state.hasOwnProperty("cuiAssignment")) {
        console.log("Upgrade state: create cuiAssignment");
        var state = angular.copy(state);
        state.cuiAssignment = {};
        angular.forEach(state.indexing.concepts, function(concept) {
            state.cuiAssignment[concept.cui] = conceptHasRelevantSemanticType(concept) ?
                    ASSIGNMENT_INCLUDE : ASSIGNMENT_EXCLUDE;
        });
    }
    if (!state.hasOwnProperty("codingSystems")) {
        console.log("Upgrade state: move codingSystems");
        state.codingSystems = state.mapping.codingSystems;
        delete state.mapping.codingSystems;
    }
    angular.forEach(state.mapping.concepts, function(concept) {
        angular.forEach(concept.sourceConcepts, function(sourceConcept) {
            if (sourceConcept.hasOwnProperty('vocabulary')) {
                sourceConcept['codingSystem'] = sourceConcept['vocabulary'];
            }
        });
    });
    return state;
}

function CodeMapperCtrl($scope, $rootScope, $http, $sce, $modal, $timeout, $interval, $q, $log, $routeParams, $location, config, urls, dataService, user) {
    
    $scope.user = user;
    $scope.project = $routeParams.project;
    $scope.caseDefinitionName = $routeParams.caseDefinitionName;
    
    var roles = user.projectPermissions[$scope.project];
    
    $rootScope.subtitle = $scope.project + ": " + $scope.caseDefinitionName;
    
    $scope.state = State.empty();
    $scope.numberUnsafedChanges = 0;
    
    dataService.completed
        .then(function() {
            $scope.loadTranslations();
        });
    
    $scope.activateTab = function(id) {
        $timeout(function() {
            $("#" + id + " > a").click();
        }, 0);
    };
    
    $scope.$on('$locationChangeStart', function(ev) {
        if ($scope.numberUnsafedChanges > 0) {
            var really = confirm("Your unsafed changes are lost when navigating away. Really?");
            if (!really) {
                ev.preventDefault();
            }
        }
    });
    
    $scope.userCanEdit = function() {
    	return roles.indexOf('Editor') != -1;
    };
    
    /* KEYBOARD */
    
    var ctrlKeydownCallbacks = {
        48 /* 0 */: function() {
            console.log("State", $scope.state);
        }
    };
    
    $rootScope.onKeydown = function(event) {
        if (event.ctrlKey) {
            var callback = ctrlKeydownCallbacks[event.keyCode];
            if (callback) {
                callback();
            } else {
            }
        }
    };
    
    /* MESSAGE */
    
    $scope.message = null;
    var timeout = null;
    $scope.setMessage = function(message, timeout) {
        $scope.message = message;
        if (timeout) {
            if (timeout != null) {
                $timeout.cancel(timeout);
            }
            timeout = $timeout(function() {
                $scope.unsetMessage();
            }, timeout);
        }
    };
    $scope.unsetMessage = function() {
        $scope.message = null;
    };
    
    /* HISTORY */
    
    /** Create a history step for $scope.state.history */
    $scope.historyStep = function(operation, argument, result, descr) {
        $scope.numberUnsafedChanges += 1;
        $scope.state.mapping.history.push({
            date: new Date().toJSON(),
            operation: operation,
            argument: argument,
            result: result,
            user: user.username
        });
    };
    
    $scope.historyGridOptions = {
        data: "state.mapping.history",
        rowHeight: 70,
        headerRowHeight: 35,
        columnDefs: historyColumnDefs,
        enableRowSelection: false
    };
    
    /* CONCEPTS */
    
    $scope.conceptsColumnDefs = createConceptsColumnDefs(true, [], true);
    $scope.conceptsGridOptions = {
        data: "state.mapping.concepts",
        rowHeight: 70,
        headerRowHeight: 35,
        showSelectionCheckbox: $scope.userCanEdit(),
        columnDefs: 'conceptsColumnDefs',
        enableRowSelection: $scope.userCanEdit,
        enableCellSelection: $scope.userCanEdit,
        filterOptions: { filterText: '' }
        //plugins: [new ngGridFlexibleHeightPlugin()]
    };
    
    $scope.$watch('state.mapping', function(mapping) {
        if (mapping == null) {
            $scope.selectedConcepts = [];
        } else {
            $timeout(function() {
                if (angular.isObject(mapping)) {
                    $scope.selectedConcepts = $scope.conceptsGridOptions.$gridScope.selectedItems;
                } else {
                    $scope.selectedConcepts = [];
                }
            }, 0);
        }
    });

    $scope.setSelectedConcepts = function(cuis) {
        $timeout(function() {
            $scope.conceptsGridOptions.selectAll(false);
            $scope.state.mapping.concepts.forEach(function(concept, index) {
                var selected = cuis.indexOf(concept.cui) != -1;
                $scope.conceptsGridOptions.selectItem(index, selected);
            });
        }, 0);
    };
    
    // Patch: adapt concepts for the code mapper application
    function patchConcept(concept0, codingSystems) {
        var concept = angular.copy(concept0);
        // Add field `codes` that is a mapping from coding systems to
        // source concepts
        concept.codes = {};
        codingSystems.forEach(function(codingSystem) {
            concept.codes[codingSystem] = concept.sourceConcepts
                .filter(function(sourceConcept) {
                    return sourceConcept.codingSystem == codingSystem;
                })
                .map(function(sourceConcept) {
                    // Select all codes by default
                    sourceConcept.selected = true;
                    return sourceConcept;
                });
        });
        // Add the count of source codes
        concept.sourceConceptsCount = concept.sourceConcepts.length; 
        // Enrich information about semantic types by descriptions and
        // groups.
        var types = concept.semanticTypes
            .map(function(type) {
                return dataService.semanticTypesByType[type].description;
            })
            .filter(function(v, ix, arr) {
                return ix == arr.indexOf(v);
            });
        var groups = concept.semanticTypes
            .map(function(type) {
                return dataService.semanticTypesByType[type].group;
            })
            .filter(function(v, ix, arr) {
                return ix == arr.indexOf(v);
            });
        concept.semantic = {
            types: types,
            groups: groups
        };
        return concept;
    }
    
    /* COMMENTS */
    
    $scope.showComments = function(concept) {
    	if ($scope.state.mapping !== null) {
    	    $scope.updateComments()
    		.success(function() {
		    showComments($modal, concept, $scope.numberUnsafedChanges == 0)
			.then(function(comment) {
			    if ($scope.numberUnsafedChanges != 0) {
			        alert("Cannot post comment with unsafed changes to the case definition");
                                return null;
			    } else {
				var url = urls.comments($scope.project, $scope.caseDefinitionName);
				var data = {
				    cui: concept.cui,
				    comment: comment
				};
				console.log(url, data);
				return $http.post(url, data, FORM_ENCODED_POST)
				    .error(function(err, code) {
					switch (code) {
					case 401:
					    alert("You are not member for project " + $scope.project + ":(");
					    break;
					default:
					    alert("Unknow error", err, code);
					}
				    })
				    .success(function() {
				        $scope.updateComments();
				    });
			    }
			});
    		});
    	}
    };
    
    $scope.updateComments = function() {
        if ($scope.state.mapping !== null) {
            return $http.get(urls.comments($scope.project, $scope.caseDefinitionName))
            .error(function(err, code) {
                switch (code) {
                    case 401:
                        alert("Not authorized. Please reload.", err);
                        break;
                    default:
                        alert("Cannot load comments", err, code);
                }
            })
            .success(function(comments) {
                var commentsByCui = {};
                angular.forEach(comments, function(comment) {
                    comment.timestamp = new Date(comment.timestamp);
                    if (!commentsByCui.hasOwnProperty(comment.cui)) {
                        commentsByCui[comment.cui] = [];
                    }
                    commentsByCui[comment.cui].push(comment);
                });
                $timeout(function() {
                    if ($scope.state.mapping != null) {
                        $scope.state.mapping.concepts.forEach(function(concept) {
                            var comments = [];
                            if (commentsByCui.hasOwnProperty(concept.cui)) {
                                comments = commentsByCui[concept.cui];
                            }
                            concept.comments = comments;
                        });
                    }
                }, 0);
            });
        } else {
            return null;
        }
    };

    var updateCommentsPromise = null;

    $scope.intervalUpdateComments = function(startNotStop) {
        if (startNotStop) {
            $scope.updateComments();
            if (updateCommentsPromise == null) {
                updateCommentsPromise = $interval($scope.updateComments, config.commentsReloadInterval);
            }
        } else {
            if (updateCommentsPromise != null) {
                $interval.cancel(updateCommentsPromise);
                updateCommentsPromise = null;	    		
            }
        }
    };

    $scope.$on('$routeChangeStart', function(scope, next, current) {
        // Stop interval update comments when leaving
        $scope.intervalUpdateComments(false);
    });
    
    /* FUNCTIONS */
    
    /** Load coding or create new coding. */
    $scope.loadTranslations = function() {
        $http.get(urls.caseDefinition($scope.project, $scope.caseDefinitionName))
            .error(function(err, code, a2) {
                switch (code) {
                case 401:
                    alert("You are not member for project " + $scope.project + ":(");
                    $location.path('/overview');
                    break;
                case 404:
                    $scope.state.mapping = null;
                    $scope.state.indexing = null;
                    $scope.state.codingSystems = INITIAL.codingSystems;
                    $scope.caseDefinition = "" + INITIAL.caseDefinition;
                    break;
                } 
            })
            .success(function(state) {
                console.log("Loaded", state);
                $scope.state = upgradeState(state);
                $scope.$broadcast("indexingUpdated", state.indexing);
                $scope.conceptsColumnDefs = createConceptsColumnDefs(true, $scope.state.codingSystems, true);
                $scope.activateTab("concepts-tab");
                if (angular.isArray(roles) && roles.indexOf('Commentator') != -1) {
                    $scope.setMessage("Use the buttons with the speech baloon on the left to view or add comments on a concept.");
                }
                $scope.intervalUpdateComments(true);
            })
        ['finally'](function() {
            $scope.numberUnsafedChanges = 0;
            $scope.conceptsColumnDefs = createConceptsColumnDefs(true, $scope.state.codingSystems, true);
        });
    };
    
    /** Ask a summary of recent changes and save/upload the coding. */ 
    $scope.saveMapping = function() {
        if ($scope.state.mapping == null) {
            error("CodeMapperCtrl.expandRelated called without state");
            return;
        }
        askSummary($modal, $scope.caseDefinitionName, $scope.state.mapping.history, $scope.numberUnsafedChanges)
            .then(function(summary) {
                $scope.historyStep("Summarize", summary, null);
                var state = angular.copy($scope.state);
                angular.forEach(state.concepts, function(concept) {
                    delete concept.comments;
                });
                var data = {
                    state: angular.toJson(state)
                };
                $http.post(urls.caseDefinition($scope.project, $scope.caseDefinitionName), data, FORM_ENCODED_POST)
                    .error(function(e, status) {
                        if (status == 401) {
                            alert("Your session has timed out :( You have to re-login!");
                        } else {
                            var msg = "ERROR: An error occurred while saving";
                            alert(msg, err);
                        }
                    })
                    .success(function() {
                        $scope.intervalUpdateComments(true);
                        $scope.numberUnsafedChanges = 0;
                    });
            });
    };
    
    $scope.addRemoveCodingSystems = function() {
        console.log("addRemoveCodingSystems", dataService);
        selectCodingSystemsDialog($modal, dataService.codingSystems, $scope.state.codingSystems)
            .then(function(newCodingSystems) {

                var addCodingSystems = newCodingSystems
                    .filter(function(codingSystem) {
                        return $scope.state.codingSystems.indexOf(codingSystem) == -1;
                    });
                var removeCodingSystems = $scope.state.codingSystems
                    .filter(function(codingSystem) {
                        return newCodingSystems.indexOf(codingSystem) == -1;
                    });

                console.log("change coding systems", newCodingSystems, addCodingSystems, removeCodingSystems);
                var data = {
                    cuis: $scope.state.mapping.concepts.map(getCui),
                    codingSystems: addCodingSystems
                };
                $http.post(urls.umlsConcepts, data, FORM_ENCODED_POST)
                    .success(function(newConcepts) {

                        var newConceptsByCui = byKey(newConcepts, getCui);
                        $scope.state.codingSystems = newCodingSystems;
                        $scope.state.mapping.concepts = $scope.state.mapping.concepts.map(function(concept) {
                            // Remove source concepts
                            concept.sourceConcepts = concept.sourceConcepts
                                .filter(function(sourceConcept) {
                                    return newCodingSystems.indexOf(sourceConcept.codingSystem) != -1;
                                });
                            // Add source concepts
                            if (newConceptsByCui.hasOwnProperty(concept.cui)) {
                                angular.forEach(newConceptsByCui[concept.cui].sourceConcepts, function(sourceConcept) {
                                    concept.sourceConcepts.push(sourceConcept);
                                });
                            }
                            return patchConcept(concept, newCodingSystems);
                        });
                        $scope.conceptsColumnDefs = createConceptsColumnDefs(true, newCodingSystems, true);
                        var arg = addCodingSystems.map(function(voc) { return "ADD "+voc; }).join(", ") +
                                  removeCodingSystems.map(function(voc) { return "REMOVE "+voc; }).join(", ");
                        var res = $scope.state.codingSystems.join(", ");
                        $scope.historyStep("Change coding systems", arg, res, null);
                    });
            });
    };
    
    $scope.createInitalTranslations = function(caseDefinition) {
        $log.info("Create initial coding");
        if ($scope.state.mapping != null || $scope.state.indexing == null) {
            error("CodeMapperCtrl.searchConcepts called with state or without indexing", $scope.state);
            return;
        }
        $scope.state.mapping = {
            concepts: null,
            history: []
        };
        $scope.conceptsColumnDefs = createConceptsColumnDefs(true, $scope.state.codingSystems, true);
        var concepts = $scope.state.indexing.concepts
            .filter(function(concept) {
                return $scope.state.cuiAssignment[concept.cui] != ASSIGNMENT_EXCLUDE; 
            });
        var data = {
            cuis: concepts.map(getCui),
            codingSystems: $scope.state.codingSystems
        };
        $http.post(urls.umlsConcepts, data, FORM_ENCODED_POST)
            .success(function(concepts) {
                $scope.state.mapping.concepts = concepts
                    .map(function(concept) {
                        var concept = patchConcept(concept, $scope.state.codingSystems);
                        concept.origin = {
                            type: "spans",
                            data: $scope.state.indexing.spans
                                .filter(function(span) {
                                    return cuiOfId(span.id) == concept.cui;
                                })[0],
                            root: null
                        };
                        return concept;
                    });
                var descr = "Automatic mapping created.";
                $scope.historyStep("Automatic coding", null, $scope.state.mapping.concepts.map(reduceConcept), descr);
                $scope.intervalUpdateComments(true);
            });
    };
    
    /** Generate a list of UMLS concept names with a given prefix. */
    $scope.autocompleteConcepts = function(str) {
        var params = {
            str: str
        };
        return $http.get(urls.autocomplete, { params: params })
            .then(function(completions) {
                if (completions.status == 200) {
                    var currentCuis = $scope.state.mapping.concepts.map(getCui);
                    return completions.data
                        .filter(function(c) {
                            return currentCuis.indexOf(c.cui) == -1; 
                        })
                        .sort(function(s1, s2) {
                            return s1.preferredName.length - s2.preferredName.length
                                || s1.preferredName.localeCompare(s2.preferredName);
                        });
                } else {
                    return null;
                }
            });
    };
    
    /**
     * Index a given query string for concepts, retrieve information and select
     * concepts in a dialog for inclusion.
     */
    $scope.searchAndAddConcepts = function(searchQuery) {
        if ($scope.state.mapping == null) {
            error("CodeMapperCtrl.searchAndAddConcepts called without mapping");
            return;
        }
        var currentCuis = $scope.state.mapping.concepts.map(getCui);
        var filteredBySemanticType = [], filteredByCurrentConcepts = [];
        indexText($http, dataService.peregrineResource, dataService.stopwords, urls.umlsConcepts, searchQuery)
            .then(function(item) {
                return item.concepts
                    .filter(function(c, ix, a) {
                        var newInMapping = currentCuis.indexOf(c.cui) == -1;
                        if (!newInMapping) {
                            filteredByCurrentConcepts.push(c);
                        }
                        return newInMapping;
                    })
                    .map(getCui);
            })
            .then(function(cuis) {
                var data = {
                    cuis: cuis,
                    codingSystems: $scope.state.codingSystems
                };
                return $http.post(urls.umlsConcepts, data, FORM_ENCODED_POST)
                    .then(function(result) {
                        var concepts = result.data;
                        concepts = concepts
                            .map(function(concept) {
                                var concept = patchConcept(concept, $scope.state.codingSystems);
                                concept.origin = {
                                    type: "search",
                                    data: searchQuery,
                                    root: null
                                };
                                return concept;
                            });
                        var comments = [];
                        if (filteredBySemanticType.length > 0) {
                            comments.push("filtered " + filteredBySemanticType.length + " by semantic types");
                        }
                        if (filteredByCurrentConcepts.length > 0) {
                            comments.push("filtered " + filteredByCurrentConcepts.length + " by current coding"); 
                        }
                        comments = comments.length > 0 ? " (" + comments.join(", ") + ")" : "";
                        if (concepts.length == 0) {
                            $scope.setMessage("No concepts found" + comments);
                            return null;
                        } else {
                            var title = "Concepts for search query \"" + searchQuery + "\"";
                            var message = "Found " + concepts.length + " concepts" + comments;
                            return selectConceptsInDialog($modal, concepts, title, true, message, $scope.state.codingSystems)
                                .then(function(selectedConcepts) {
                                    if (angular.isArray(selectedConcepts)) {
                                        $scope.state.mapping.concepts = [].concat(selectedConcepts, $scope.state.mapping.concepts);
                                        $scope.setSelectedConcepts(selectedConcepts.map(getCui));
                                        var descr = "Added " + selectedConcepts.length + " concepts by search on \"" + searchQuery + "\"";
                                        $scope.historyStep("Search", searchQuery, selectedConcepts.map(reduceConcept), descr);
                                        $scope.searchQuery = "";
                                    }
                                });
                        }
                    });
            });
    };
    
    $scope.searchAndAddConceptDirect = function(concept0) {
        console.log("Search&add direct", concept0);
        var data = {
            cuis : [concept0.cui],
            codingSystems : $scope.state.codingSystems
        };
        $http.post(urls.umlsConcepts, data, FORM_ENCODED_POST)
            .error(handleError)
            .success(function(concepts) {
                var concept = patchConcept(concepts[0], $scope.state.codingSystems);
                concept.origin = {
                    type: "add",
                    data: concept.preferredName,
                    root: null
                };
                $scope.state.mapping.concepts = [].concat([concept], $scope.state.mapping.concepts);
                $scope.setSelectedConcepts([concept.cui]);
                var descr = "Added concept " + concept.preferredName;
                $scope.historyStep("Add", null, reduceConcept(concept), descr);
                $scope.searchQuery = "";
            });
    };
    
    /** Reset the coding of the case definition by deleting the state. Re-enable
     * input for case definition, semantic types and coding systems. */
    $scope.discardMapping = function() {
        console.log("DISCARD");
        $scope.$apply(function() {
            $scope.intervalUpdateComments(false);
            $scope.state.mapping = null;
            $scope.conceptsColumnDefs = createConceptsColumnDefs(true, [], false);
        });
    };
    
    /** Delete a concepts from $scope.state.concepts by its cui. */
    $scope.operationDeleteConcepts = function(concepts) {
        if ($scope.state == null || $scope.state.mapping == null) {
            error("CodeMapperCtrl.deleteConcept called without mapping");
            return;
        }
        $scope.$apply(function() {
            var cuis = concepts.map(getCui);
            var deletedCuis = [];
            var deletedNames = [];
            $scope.state.mapping.concepts = $scope.state.mapping.concepts
                .filter(function(concept) {
                    if (cuis.indexOf(concept.cui) != -1) {
                        deletedNames.push(concept.preferredName);
                        deletedCuis.push(concept.cui);
                        return false;
                    } else {
                        return true;
                    }
                });
            $scope.setSelectedConcepts([]);
            var descr = "Deleted " + deletedCuis.length + " " + pluralize("concept", deletedCuis.length); 
            $scope.historyStep("Delete", concepts.map(reduceConcept), null, descr);
        });
    };
    
    /**
     * Expand a given concept to its hypernyms or hyponyms, show selection
     * dialog and integrate in the list of concepts ($scope.state.concepts).
     */
    $scope.operationExpandRelatedConcepts = function(concepts, hyponymsNotHypernyms) {
        if ($scope.state == null || $scope.state.mapping == null) {
            error("CodeMapperCtrl.expandRelated called without mapping");
            return;
        }
        var conceptNames =concepts.length <= 3
                ? concepts.map(function(c) { return c.preferredName; }).join(", ")
            : concepts.length + " " + pluralize("concept", concepts);
        var hyponymOrHypernym = hyponymsNotHypernyms ? "hyponym" : "hypernym";
        var cuis = concepts.map(getCui);
        var data = {
            cuis: cuis,
            hyponymsNotHypernyms: hyponymsNotHypernyms,
            codingSystems: $scope.state.codingSystems
        };
        var currentCuis = $scope.state.mapping.concepts.map(getCui);
        // Retrieve related concepts from the API
        $http.post(urls.relatedConcepts, data, FORM_ENCODED_POST)
            .error(function(err, status) {
                if (status == 401) {
                    alert("Your session has timed out :( You have to re-login!");
                } else {
                    var msg = "ERROR: Couldn't lookup related concepts at " + urls.relatedConcepts;
                    alert(msg);
                    console.log(msg, err);
                }
            })
            .success(function(relatedConceptsByCuis) {
                var relatedConcepts = [];
                angular.forEach(relatedConceptsByCuis, function(relatedConceptsForCui, forCui) {

                    var relatedConceptsCuis = relatedConcepts.map(getCui);
                    relatedConceptsForCui = relatedConceptsForCui
                        .filter(function(c, ix, a) {
                            return currentCuis.indexOf(c.cui) == -1 // Not yet in mapping
                                && relatedConceptsCuis.indexOf(c.cui) == -1 // Not a duplication for another CUI  
                                && isFirstOccurrence(c, ix, a) // Not a duplication for this CUI
                            ;
                        })
                        .map(function(concept) {
                            return patchConcept(concept, $scope.state.codingSystems);
                        });

                    relatedConceptsForCui.forEach(function(c) {
                        c.origin = {
                            type: hyponymOrHypernym,
                            data: {
                                cui: forCui,
                                preferredName: concepts.filter(function(c1) { return forCui == c1.cui; })[0].preferredName
                            },
                            root: reduceConcept(concepts[concepts.map(getCui).indexOf(forCui)])
                        };
                    });
                    relatedConcepts = relatedConcepts.concat(relatedConceptsForCui);
                });
                var specificOrGeneral = hyponymsNotHypernyms ? "specific" : "general";
                var title = "Concepts that are more " + specificOrGeneral + " than " + conceptNames;
                selectConceptsInDialog($modal, relatedConcepts, title, true, null, $scope.state.codingSystems)
                    .then(function(selectedRelatedConcepts) {
                        
                        // Search position of original inital concepts
                        var conceptOffsets = {};
                        cuis.forEach(function(cui) {
                            $scope.state.mapping.concepts.forEach(function(c, cIx) {
                                if (c.cui == cui) {
                                    conceptOffsets[cui] = cIx;
                                }
                            });
                        });
                        
                        // Insert each related concept in list of concepts
                        selectedRelatedConcepts.forEach(function(related, ix) {
                            var offset = ++conceptOffsets[related.origin.data.cui];
                            $scope.state.mapping.concepts.splice(offset, 0, related);
                        });
                        $scope.setSelectedConcepts(selectedRelatedConcepts.map(getCui));
                        
                        var descr = "Expanded " + conceptNames +
                                " with " + selectedRelatedConcepts.length + 
                                " " + pluralize(hyponymOrHypernym, selectedRelatedConcepts);
                        var operation = hyponymsNotHypernyms ? "Expand to more specific" : "Expand to more general";
                        $scope.historyStep(operation, concepts.map(reduceConcept), selectedRelatedConcepts.map(reduceConcept), descr);
                    });
            })
            ['finally'](function() {
                blockUI.stop();
            });
    };
    
    $scope.operationEditCodes = function(concepts) {
        editCodes($modal, concepts, $scope.state.codingSystems)
            .then(function(codes) {
                function isSelected(cui, codingSystem, id) {
                    return codes.filter(function(code) {
                        return code.cui == cui && code.codingSystem == codingSystem && code.id == id;
                    }).length > 0;
                };
                var added = [];
                var removed = [];
                concepts.forEach(function(concept) {
                    $scope.state.codingSystems.forEach(function(codingSystem) {
                        concept.codes[codingSystem].forEach(function(code) {
                            var selected = isSelected(code.cui, code.codingSystem, code.id);
                            if (!code.selected && selected) {
                                added.push({
                                    code: code,
                                    concept: concept
                                });
                            }
                            if (code.selected && !selected) {
                                removed.push({
                                    code: code,
                                    concept: concept
                                });
                            }
                            code.selected = selected;
                        });
                    });
                });
                if (added.length == 0 && removed.length == 0) {
//                    $scope.setMessage("No codes changed");                    
                } else {
                    var descr, result;
                    var resultCodes = function(codes, preposition) {
                        return codes.map(function(cc) {
                            return cc.code.id + " (" + cc.code.codingSystem + ") " + preposition + " " + cc.concept.preferredName;
                        }).join(", ");
                    };
                    if (removed.length == 0) {
                        descr = "Added " + added.length + " codes";
                        result = "added: " + resultCodes(added, "to");
                    } else if (added.length == 0) {
                        descr = "Removed " + removed.length + " codes";
                        result = "removed: " + resultCodes(removed, "from");
                    } else {
                        descr = "Added " + added.length + " and removed " + removed.length + " codes";
                        result = "added: " + resultCodes(added, "to") + ", removed: " + resultCodes(removed, "from");
                    }
                    $scope.historyStep("Edit codes", concepts.map(reduceConcept), result, descr);
                }
            });
    };

    $scope.downloadConceptsAsExcel = function() {
        var url = urls.downloadExcel +
                '?project=' + encodeURIComponent($scope.project) +
                '&caseDefinition=' + encodeURIComponent($scope.caseDefinitionName) +
                '&url=' + encodeURIComponent(window.location.href);
        window.open(url, '_blank');
    };

    $scope.downloadConcepts = function() {
        if ($scope.state.mapping == null) {
            error("CodeMapperCtrl.downloadConcepts called without state");
            return;
        }
        console.log("Download concepts");

        var data = [];

        [ ["CASE DEFINITION", $scope.caseDefinitionName],
          ["ADVANCE Code Mapper", $location.absUrl()]
        ].forEach(function(row) { data.push(row); });
        
        [ [],
          ["CODES"],
          ["CODING SYSTEMS", "CODE", "NAME IN CODING SYSTEM", "UMLS CONCEPT NAME", "UMLS ID", "ORIGIN", "ROOT CONCEPT"]
        ].forEach(function(row) { data.push(row); });
        $scope.state.codingSystems.forEach(function(codingSystem) {
            $scope.state.mapping.concepts.forEach(function(concept) {
                var origin = "?";
                if (concept.origin.type == "spans") {
                    origin = "In case definition (\"" + concept.origin.data.text + "\")";
                }
                if (concept.origin.type == "hyponym") {
                    origin = "More specific than " + concept.cui + " (" + concept.origin.data.preferredName + ")";
                }
                if (concept.origin.type == "hypernym") {
                    origin = "More general than " + concept.cui + " (" + concept.origin.data.preferredName + ")";
                }
                if (concept.origin.type == "search") {
                    origin = "By query \"" + concept.origin.data + "\"";
                }
                if (concept.origin.type == "add") {
                    origin = "Added";
                }
                var root = angular.isObject(concept.origin.root) ? concept.origin.root.cui : "";
                concept.codes[codingSystem].forEach(function(code) {
                    if (code.selected) {
                        data.push([codingSystem, code.id, code.preferredTerm, concept.preferredName, concept.cui, origin, root]);
                    }
                });
            });
        });
        
        [ [],
          ["HISTORY"],
          ["DATE", "OPERATION", "ARGUMENT", "RESULT"]
        ].forEach(function(row) { data.push(row); });
        if ($scope.state.mapping.history) {
            $scope.state.mapping.history.forEach(function(step) {
                data.push([step.date.toLocaleString(),
                           step.operation,
                           historyDatumToString(step.argument), 
                           historyDatumToString(step.result)]);
            });
        }
        
        [ [],
          ["CASE DEFINITION TEXT"]
        ].forEach(function(row) { data.push(row); });
        $scope.state.indexing.caseDefinition.split("\n").forEach(function(line) {
            data.push([line]);
        });
        
        var csv = csvEncode(data);
        console.log(csv);
        var file = new Blob([ csv ], {
            type : 'attachment/csv;charset=UTF-8'
        });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.target = '_blank';
        a.download = $scope.project + '_' + $scope.caseDefinitionName + '.csv';
        document.body.appendChild(a);
        $timeout(function() {
            a.click();
        }, 0);
    };
};

function selectCodingSystemsDialog($modal, codingSystems, currentCodingSystems) {
    var dialog = $modal.open({
        templateUrl: 'partials/coding-systems.html',
        controller: 'SelectCodingSystemsCtrl',
        size: 'lg',
        resolve: {
            codingSystems: function() { return codingSystems; },
            currentCodingSystems: function() { return currentCodingSystems; }
        }
    });
    return dialog.result;
};

function SelectCodingSystemsCtrl($scope, $modalInstance, $timeout, codingSystems, currentCodingSystems) {

    $scope.codingSystems = codingSystems;
    $scope.currentCodingSystems = currentCodingSystems;
    $scope.codingSystemsByName = byKey(codingSystems, getAbbreviation);

    $scope.gridOptions = {
        data: "codingSystems",
        rowHeight: 35,
        showSelectionCheckbox: true,
        filterOptions: { filterText: '' },
        columnDefs: [
             { displayName: 'Name', field: 'name' },
             { displayName: 'Abbreviation', field: 'abbreviation' },
         ]
    };

    $timeout(function() {
        angular.forEach($scope.codingSystems, function(codingSystem, index) {
            if (currentCodingSystems.indexOf(codingSystem.abbreviation) != -1) {
                $scope.gridOptions.selectItem(index, true);
            }
        });
        console.log($scope.gridOptions);
    }, 0);

    $scope.unselect = function(abbreviation) {
        $scope.codingSystems.forEach(function(voc1, index) {
            if (abbreviation == voc1.abbreviation) {
                $scope.gridOptions.selectItem(index, false);
            }
        });
    };
    
    $scope.ok = function (newCodingSystems) {
        newCodingSystems = newCodingSystems.map(getAbbreviation);
        $modalInstance.close(newCodingSystems);
    };
    $scope.cancel = function () {
        $modalInstance.dismiss();
    };
}

/** The controller for the dialog to select hyper-/hyponyms. */
function ShowConceptsCtrl($scope, $modalInstance, $timeout, concepts, codingSystems, title, selectable, message) {
    
    $scope.message = message;
    $scope.concepts = concepts;
    $scope.title = title;
    $scope.selectable = selectable;

    $scope.conceptsGridOptions = {
        data: "concepts",
        rowHeight: 70,
        headerRowHeight: 30,
        filterOptions: { filterText: '' },
        enableRowSelection: $scope.selectable,
        showSelectionCheckbox: $scope.selectable,
        columnDefs: createConceptsColumnDefs(false, codingSystems, false)
    };
    
    $scope.ok = function () {
        $modalInstance.close(selectable ? $scope.conceptsGridOptions.$gridScope.selectedItems : concepts);
    };
    $scope.cancel = function () {
        console.log("yyy");
        $modalInstance.dismiss('cancel');
    };
};

function selectConceptsInDialog($modal, concepts, title, selectable, message, codingSystems) {
    // Display retrieved concepts in a dialog
    var dialog = $modal.open({
        templateUrl: 'partials/ShowConcepts.html',
        controller: 'ShowConceptsCtrl',
        size: 'lg',
        resolve: {
            title: function() { return title; },
            concepts: function() { return concepts.sort(compareByCodeCount); },
            codingSystems: function() { return codingSystems; },
            selectable: function() { return selectable; },
            message: function() { return message; }
        }
    });
    return dialog.result;
};

function EditCodesCtrl($scope, $modalInstance, $timeout, concepts, codes) {
    $scope.concepts = concepts;
    $scope.codes = codes.map(function(code) {
        code.conceptName = code.concept.preferredName;
        return code;
    });
    $scope.gridOptions = {
        data: "codes",
        filterOption: { filterText: '' },
        enableRowSelection: true,
        showSelectionCheckbox: true,
        columnDefs: [
            { displayName: 'Coding system', field: 'codingSystem' },
            { displayName: 'Code', field: 'id',
              cellTemplate:
              "<span ng-bind='row.getProperty(col.field)' title='{{row.entity.preferredTerm}}' " +
              "class='code' ng-class=\"row.selected ? 'selected' : 'unselected'\"></span>"
            },
            { displayName: 'Preferred term (in coding system)', field: 'preferredTerm' },
            { displayName: 'Concept', field: 'conceptName' }
        ]
    };
    $timeout(function() {
        codes.forEach(function(code, index) {
            $scope.gridOptions.selectItem(index, code.selected);
        });
    }, 0);
    $scope.ok = function() {
        $modalInstance.close($scope.gridOptions.$gridScope.selectedItems);
    };
    $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
    };
}

function editCodes($modal, concepts, codingSystems) {
    var dialog = $modal.open({
        templateUrl: 'partials/EditCodes.html',
        controller: 'EditCodesCtrl',
        size: 'lg',
        resolve: {
            concepts: function() {
                return concepts;
            },
            codes: function() { 
                var codes = [];
                concepts.forEach(function(concept) {
                    codingSystems.forEach(function(codingSystem) {
                        concept.codes[codingSystem].forEach(function(code0) {
                            var code = angular.copy(code0);
                            code.concept = concept;
                            codes.push(code);
                        });
                    });
                });
                return codes;
            }
        }
    });
    return dialog.result;
}

function ChangePasswordCtrl($scope, $modalInstance, $http, urls) {
	
	$scope.change = function(oldPassword, newPassword) {
		console.log(oldPassword, newPassword);
		var data = {
		    oldPassword: oldPassword,
		    newPassword: newPassword
		};
		$http.post(urls.changePassword, data, FORM_ENCODED_POST)
		    .error(function(err, code) {
		    	alert("Unknow error", err, code);
		    })
		    .success(function(result) {
		    	console.log("ChangePasswordCtrl.success", result);
		    	if (result.ok) {
		    		$modalInstance.close();
		    	} else {
		    		$scope.message = result.message || "Couldn't change password (password OK?)";
		    	}
		    });
	};

    $scope.cancel = function () {
        $modalInstance.dismiss();
    };
}

function changePassword($modal) {

    var dialog = $modal.open({
        templateUrl: 'partials/ChangePassword.html',
        controller: 'ChangePasswordCtrl',
        size: 'sm',
        resolve: {
        }
    });
    return dialog.result;
}

function AskChangesSummaryCtrl($scope, $http, $modalInstance, $timeout, caseDefinitionName, changes) {
    
    $scope.summary = "";
    $scope.caseDefinitionName = caseDefinitionName;
    $scope.changes = changes;

    $scope.changesGridOptions = {
        data: "changes",
        enableRowSelection: false,
        columnDefs: historyColumnDefs
    };

    $scope.save = function (summary) {
        $modalInstance.close(summary);
    };
    
    $scope.cancel = function () {
        $modalInstance.dismiss();
    };
}

function askSummary($modal, caseDefinitionName, history, numberUnsafedChanges) {

    var dialog = $modal.open({
        templateUrl: 'partials/AskChangesSummary.html',
        controller: 'AskChangesSummaryCtrl',
        size: 'lg',
        resolve: {
            caseDefinitionName: function() { return caseDefinitionName; },
            changes: function() {
                return history.slice(history.length - numberUnsafedChanges);
            }
        }
    });       
    return dialog.result;
}

function ShowCommentsCtrl($scope, $http, $modalInstance, concept, canEnterNewComment) {
    $scope.concept = concept;
    $scope.canEnterNewComment = canEnterNewComment;
    $scope.newComment = { text: "" };
    $scope.save = function(newComment) {
	$modalInstance.close(newComment.text);
    };
    $scope.cancel = function() {
	$modalInstance.dismiss();
    };
}

function showComments($modal, concept, canEnterNewComment) {
    var dialog = $modal.open({
	templateUrl: 'partials/ShowComments.html',
	controller: 'ShowCommentsCtrl',
	size: 'lg',
	resolve: {
	    concept: function() { return concept; },
	    canEnterNewComment: function() { return canEnterNewComment; }
	}
    });
    return dialog.result;
}

var originColumnDef = {
    displayName: 'Origin',
    cellClass: 'scroll-y',
    field: 'origin',
    cellTemplate: "partials/originColumn.html",
    sortFn: function(ss1, ss2) {
        ss1 = ss1.map(function(s) { return s.text; });
        ss2 = ss2.map(function(s) { return s.text; });
        if (ss1.length != ss2.length) {
            return ss2.length - ss1.length;
        } else {
            var s1 = ss1.join();
            var s2 = ss2.join();
            return s1 < s2 ? -1 : (s2 < s1 ? 1 : 0);
        }
    }
};


/** Generate column definitions */
function createConceptsColumnDefs(showOrigin, codingSystems, showComments) {

    var name = 
            { displayName: "Name", field: 'preferredName', cellClass: 'cellToolTip', cellTemplate: "partials/nameCell.html"};
    
    var cuiCellTemplate = "<span class='cui' ng-bind='row.entity.cui' title='{{row.entity.preferredName}}'></span>";
    var cui = { displayName: "UMLS", field: 'cui', cellTemplate: cuiCellTemplate };
    
    codingSystems = angular.copy(codingSystems);
    codingSystems.sort();
    var codingSystemsColumnDefs = codingSystems
        .map(function(codingSystem) {
            return {
                displayName: codingSystem,
                field: "codes." + codingSystem,
                cellClass: 'scroll-y',
                cellTemplate:
                "<span ng-repeat='code in row.getProperty(col.field)' ng-bind='code.preferredTerm' title='{{code.id}}'" +
                    "class='code' ng-class=\"code.selected ? 'selected' : 'unselected'\"></span>",
                sortFn: function(cs1, cs2) {
                    if (cs1.length != cs2.length) {
                        return cs2.length - cs1.length;
                    } else {
                        var s1 = cs1.join();
                        var s2 = cs2.join();
                        return s1 < s2 ? -1 : (s2 < s1 ? 1 : 0);
                    }
                }
            };
        });
    
    var comments = {
        width: 75,
		displayName: "",
		field: "comments",
		cellTemplate: "partials/commentsCell.html"
    };
    
    return [].concat(
        [name],
        showOrigin ? [originColumnDef] : [],
        SHOW_UMLS_COLUMN ? [cui] : [],
        codingSystemsColumnDefs,
        showComments ? [comments] : []);
}


var historyColumnDefs = [
    { field: "date", displayName: "Date" },
    { field: "user", displayName: "User" },
    { field: "operation", displayName: "Operation" },
    { field: "argument", displayName: "Argument",
      cellTemplate: "<span>{{row.entity[col.field] | historyDatumToString}}</span>" },
    { field: "result", displayName: "Result",
      cellTemplate: "<span>{{row.entity[col.field] | historyDatumToString}}</span>" }
];
